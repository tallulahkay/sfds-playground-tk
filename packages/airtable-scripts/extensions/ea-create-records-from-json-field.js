	// "import" these utilities from the functions at the end of this script
const { getCell, getCellHash, getFieldsByName, loopChunks } = utils();
const { getSubmissionTableStatus, getReviewTableStatus } = status();

const ScreendoorTableName = "SCREENDOOR_EQUITY_APPLICANT";
const ScreendoorRevTableName = "SCREENDOOR_EQUITY_APPLICANT_REV";
const ScreendoorFields = [
	"SUBMITTED_AT",
	"RESPONSE_ID",
	"RESPONSE_NUM",
	"RESPONSE_JSON",
	"AIRTABLE_JSON",
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

const startTime = Date.now();
const screendoorTable = base.getTable(ScreendoorTableName);
const screendoorRevTable = base.getTable(ScreendoorRevTableName);
	// combine the original submissions and revisions into one list for processing
const screendoorRecords = [
	...(await screendoorTable.selectRecordsAsync({
		fields: ScreendoorFields
	})).records,
	...(await screendoorRevTable.selectRecordsAsync({
		fields: ScreendoorFields
	})).records
]
		// hack the submitted date string into something parseable without moment.js, and store it with the record, so we
		// can sort the array by the date next
	.map((record) => ([new Date(getCell(record, ScreendoorFields[0]).replace(/([ap]m)/, " $1")), record]))
	.sort((a, b) => b[0] - a[0]);

const submissionsTable = base.getTable(SubmissionsTableName);
const submissionFieldsByName = getFieldsByName(submissionsTable);
const submissionLabelsByResponse = {};
const submissions = screendoorRecords.map(([submitted, record], i) => {
	const [responseID, responseNum, screendoorJSON, airtableJSON] = getCell(record, ScreendoorFields.slice(1));

	if (!airtableJSON) {
			// some of the Screendoor records don't have any converted Airtable JSON associated with them, possibly
			// because they're from an old form we're not migrating.  so ignore those records.
		console.log(`Skipping empty Airtable JSON: ${i} ${record.id} ${responseID} ${submitted} ${screendoorJSON.slice(0, 200)}`);

		return null;
	}

	const airtableData = JSON.parse(airtableJSON);
	const { labels } = JSON.parse(screendoorJSON);

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

		// we have to convert the submitted date from a Date object to an ISO string in order to write it into a record
	airtableData.Submitted = submitted.toISOString();

		// this key is in the Airtable JSON, but for the revisions, it's not the ID of the original submission; it's some
		// other, unrelated ID.  but we need the original response ID to link the revisions to the originals.  so overwrite
		// the RESPONSE_ID field in the Airtable data with the one from Screendoor.  the revisions also won't have the
		// sequential_id in the JSON, so take it from the RESPONSE_NUM field in the record.
	airtableData.RESPONSE_ID = responseID;
	airtableData.RESPONSE_NUM = responseNum;

		// keep track of the labels from the Screendoor data, which we'll use below to update the Review and Submission
		// Status fields in the Reviews table.  the whole reason we're sorting the screendoorRecords above is so that we can
		// capture the labels from the most recent submission in this map.
	if (!(responseID in submissionLabelsByResponse)) {
		submissionLabelsByResponse[responseID] = labels;
	}

		// combine the migrated Airtable fields with status fields set by the Screendoor labels
	return {
		fields: {
			...getSubmissionTableStatus(labels),
			...airtableData
		}
	};
})
		// filter out any records with no JSON
	.filter((record) => !!record);

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

const reviewsTable = base.getTable(ReviewsTableName);
const reviews = [];

output.markdown(`Starting creation of ${Object.keys(submissionRecIDsByResponse).length} reviews...`);

	// step through each set of related submissions
for (const [latestID, ...previousIDs] of Object.values(submissionRecIDsByResponse)) {
		// get the created record for the most recent submission, so we can get any fields set by formulas
		// that we need to use when generating the review data below
	const latestRecord = await submissionsTable.selectRecordAsync(latestID.id);
	const latest = getCellHash(latestRecord, Object.values(SubmissionFields));
	const responseID = latest[SubmissionFields.ID];
	const labels = submissionLabelsByResponse[responseID];
	const [reviewStatus, submissionStatus] = getReviewTableStatus(labels, previousIDs.length);

	reviews.push({
		fields: {
			[ReviewFields.MostRecent]: [latestID],
			[ReviewFields.Previous]: previousIDs,
			[ReviewFields.NameID]: latest[SubmissionFields.NameID],
			[ReviewFields.ReviewStatus]: reviewStatus,
			[ReviewFields.SubmissionStatus]: submissionStatus,
			[ReviewFields.SubmissionID]: latest[SubmissionFields.SubmissionID],
			[ReviewFields.ResponseID]: responseID,
			[ReviewFields.ResponseNum]: latest[SubmissionFields.Num],
		}
	});
}

await loopChunks(reviews, ChunkSize, (chunk) => reviewsTable.createRecordsAsync(chunk));

output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s**`);


// =======================================================================================
// these reusable utility functions can be "imported" by destructuring the functions below
// =======================================================================================

function status() {
	const LabelToSubmissionTableStatus = {
		"0: Asset Test": ["Assets Verification Status", "Verified"],
		"1: Income": ["Criteria 5: Income Verification Status", "Verified"],
		"2: CJI": ["Criteria 3: Applicant Arrest Verification Status", "Verified"],
		"3: CJI (Family)": ["Criteria 4: Family Arrest Verification Status", "Verified"],
		"4: Housing": ["Criteria 1: Eviction Verification Status", "Verified"],
		"5: SFUSD": ["Criteria 2: SFUSD Verification Status", "Verified"],
		"6: Census": ["Criteria 6: Neighborhood Verification Status", "Verified"]
	};
	const LabelToReviewTableStatus = {
		"Archived_Duplicate Equity Verification App": ["Archived", null],
		"Asset Test Question": ["Processing", ["New submission", "Sent to applicant for edits"]],
		"Denial": ["Denied", null],
		"Director's Review": ["Director's Review", ["New submission", "New edits received"]],
		"No Documents": ["Processing", "Sent to applicant for edits"],
		"On Hold": ["On-Hold", null],
		"?:Question": ["Processing", "Sent to applicant for edits"],
		"Updated": [null, ["New submission", "New edits received"]],
		"Verified": ["Verified", "Submission verified"],
		"Verified: Email Needed": ["Verified", "Submission verified"],
			// this undefined row is used as the default when there are no matching labels
		[undefined]: [null, ["New submission", "New edits received"]],
	};

	function getSubmissionTableStatus(
		labels = [])
	{
		return labels.reduce((result, label) => {
			const [fieldName, statusName] = LabelToSubmissionTableStatus[label] || [];

			if (fieldName) {
				result[fieldName] = { name: statusName };
			}

			return result;
		}, {});
	}

	function getReviewTableStatus(
		labels = [],
		revisionCount)
	{
		const label = labels.find((string) => string in LabelToReviewTableStatus);
		let [review, submission] = LabelToReviewTableStatus[label];

		if (Array.isArray(submission)) {
				// the Submission Status field may have different values depending on whether there are previous submissions or not
			submission = submission[revisionCount === 0 ? 0 : 1];
		}

		return [review, submission].map((name) => name ? ({ name }) : null);
	}

	return {
		getSubmissionTableStatus,
		getReviewTableStatus
	};
}

function utils() {
	class GroupedArray {
		constructor(
			initialGroups = {})
		{
			this.groups = { ...initialGroups };
		}

		push(
			key,
			value)
		{
			const arr = this.groups[key] || (this.groups[key] = []);

			arr.push(value);
		}

		get(
			key)
		{
			return this.groups[key];
		}

		getAll()
		{
			return this.groups;
		}
	}

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
		GroupedArray,
		Progress,
		loopChunks,
		getCell,
		getCellHash,
		getFieldsByName,
	};
}
