	// "import" these utilities from the function at the end of this script
const { getCell, getCellHash, getFieldsByName, loopChunks } = utils();

const ScreendoorTableName = "SCREENDOOR_EQUITY_APPLICANT";
const ScreendoorRevTableName = "SCREENDOOR_EQUITY_APPLICANT_REV";
const ScreendoorFields = [
	"AIRTABLE_JSON",
	"RESPONSE_ID",
	"SUBMITTED_AT",
];
const SubmissionsTableName = "TEST Equity Applicant Submissions";
const SubmissionFields = {
	ID: "RESPONSE_ID",
	Num: "RESPONSE_NUM",
	SubmissionID: "SUBMISSION_ID",
	Submitted: "Submitted",
	NameID: "Name ID",
};
const ReviewsTableName = "TEST Equity Applicant Reviews";
const ReviewFields = {
	MostRecent: "Most Recent Submission",
	Previous: "Previous Submissions",
	NameID: "Name ID",
	ReviewStatus: "Review Status",
	SubmissionStatus: "Submission Status",
	SubmissionID: "Submission ID",
	ResponseID: "Screendoor Response ID",
	ResponseNum: "Screendoor Response Number",
};
const ChunkSize = 50;

const bySubmittedDesc = (a, b) => new Date(b.fields.Submitted) - new Date(a.fields.Submitted);

const startTime = Date.now();
const jsonTable = await base.getTable(ScreendoorTableName);
const jsonRevTable = await base.getTable(ScreendoorRevTableName);
	// combine the original submissions and revisions into one list for processing
const jsonRecords = [
	...(await jsonTable.selectRecordsAsync({
		fields: ScreendoorFields
	})).records,
	...(await jsonRevTable.selectRecordsAsync({
		fields: ScreendoorFields
	})).records
];

const submissionsTable = await base.getTable(SubmissionsTableName);
const submissionFieldsByName = getFieldsByName(submissionsTable);
const submissions = jsonRecords.map((record) => {
	const [json, responseID, Submitted] = getCell(record, ScreendoorFields);

	if (!json) {
			// some of the Screendoor records don't have any converted Airtable JSON associated with them, possibly
			// because they're from an old form we're not migrating.  so ignore those records.
		console.log(`Skipping empty Airtable JSON: ${record.id} ${Submitted}`);

		return null;
	}

	const airtableData = JSON.parse(json);

	Object.entries(airtableData).forEach(([key, value]) => {
		const { type } = submissionFieldsByName[key];

			// the JSON is coming in with bare strings for select values, so fix those
		if (type === "singleSelect") {
			airtableData[key] = { name: value };
		} else if (type === "multipleSelects") {
			airtableData[key] = value.map((name) => ({ name }));
		} else if (key.includes(".upload")) {
				// break the comma-delimited files into one per line
			airtableData[key] = value.replace(/,/g, "\n");
		} else if (key.startsWith("SCREENDOOR") && SubmissionsTableName.startsWith("TEST")) {
				// this link to another record in the SCREENDOOR_EQUITY_APPLICANT field doesn't seem to work when we're
				// working with the test table, so delete it for now
			delete airtableData[key];
		}
	});

		// hack the date string into something parseable without moment.js
	airtableData.Submitted = new Date(Submitted.replace(/([ap]m)/, " $1")).toISOString();

		// this key is in the Airtable JSON, but for the revisions, it's not the ID of the original submission, which we
		// need it to be to link the revisions to the originals.  so overwrite it with the RESPONSE_ID field.
	airtableData.RESPONSE_ID = responseID;

	return { fields: airtableData };
})
		// filter out any records with no JSON
	.filter((record) => !!record);

submissions.sort(bySubmittedDesc);

const submissionRecIDsByResponse = {};

output.markdown(`Starting import of ${submissions.length} submissions...`);

await loopChunks(submissions, ChunkSize, async (chunk) => {
	const records = await submissionsTable.createRecordsAsync(chunk);

	chunk.forEach((submission, i) => {
		const { fields: { [SubmissionFields.ID]: id } } = submission;
		const submissionRecords = (submissionRecIDsByResponse[id] || (submissionRecIDsByResponse[id] = []));

		submissionRecords.push({ id: records[i] });
	});
});

const reviewsTable = await base.getTable(ReviewsTableName);
const reviews = [];

output.markdown(`Starting creation of ${Object.keys(submissionRecIDsByResponse).length} reviews...`);

	// step through each set of related submissions
for (const [latestID, ...previousIDs] of Object.values(submissionRecIDsByResponse)) {
		// get the created record for the most recent submission, so we can get any fields set by formulas
		// that we need to use when generating the review data below
	const latestRecord = await submissionsTable.selectRecordAsync(latestID.id);
	const latest = getCellHash(latestRecord, Object.values(SubmissionFields));
	const status = previousIDs.length
		? "New edits received"
		: "New submission";

	reviews.push({
		fields: {
			[ReviewFields.MostRecent]: [latestID],
			[ReviewFields.Previous]: previousIDs,
			[ReviewFields.NameID]: latest[SubmissionFields.NameID],
			[ReviewFields.ReviewStatus]: { name: "Submitted" },
			[ReviewFields.SubmissionStatus]: { name: status },
			[ReviewFields.SubmissionID]: latest[SubmissionFields.SubmissionID],
			[ReviewFields.ResponseID]: latest[SubmissionFields.ID],
			[ReviewFields.ResponseNum]: latest[SubmissionFields.Num],
		}
	});
}

await loopChunks(reviews, ChunkSize, (chunk) => reviewsTable.createRecordsAsync(chunk));

output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s**`);


// ==================================================================================
// this set of reusable utility functions can be "imported" by destructuring utils()
// ==================================================================================
function utils() {
	class Progress {
		constructor({
			total,
			done = 0,
			printStep = 10 })
		{
			const startingPct = (done / total) * 100;

			this.total = total;
			this.done = done;
			this.printStep = printStep;
			this.lastPctStep = startingPct - (startingPct % printStep) + printStep;
			this.startTime = Date.now();

			if (this.done > 0) {
				output.markdown(`Starting at **${this.pctString()}%**.`);
			}
		}

		increment(
			progress)
		{
			this.done += progress;

			if (this.pct() >= this.lastPctStep) {
					// we've past another full step, so print the current progress and the total time in seconds
				output.markdown(`**${this.pctString()}%** done \\[${((Date.now() - this.startTime) / 1000).toFixed(2)}s\\]`);
				this.lastPctStep += this.printStep;
			}
		}

		pct()
		{
			return (this.done / this.total) * 100;
		}

		pctString()
		{
			return this.pct().toFixed(1);
		}
	}

	async function loopChunks(
		items,
		chunkSize,
		loopFn)
	{
		const updateProgress = new Progress({
			total: items.length,
			printStep: 5
		});

		for (let i = 0, len = items.length; i < len; i += chunkSize) {
			const chunk = items.slice(i, i + chunkSize);

			try {
				const result = await loopFn(chunk, i);

				updateProgress.increment(chunk.length);

				if (result === true) {
						// return true to break out of the loop early
					return;
				}
			} catch (e) {
				console.error(e);
				console.error("Bad chunk", i, chunk);
			}
		}
	}

	function getCell(
		record,
		fieldNames)
	{
		const names = [].concat(fieldNames);
		const result = names.map((name) => record.getCellValueAsString(name));

		return result.length > 1
			? result
			: result[0];
	}

	function getCellHash(
		record,
		fieldNames)
	{
		const result = [].concat(getCell(record, fieldNames));

		return Object.fromEntries(result.map((value, i) => [fieldNames[i], value]));
	}

	function getFieldsByName(
		table)
	{
		return table.fields.reduce((result, field) => ({
			...result,
			[field.name]: field
		}), {});
	}

	return {
		Progress,
		loopChunks,
		getCell,
		getCellHash,
		getFieldsByName,
	};
}
