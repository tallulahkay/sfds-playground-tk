	// "import" these utilities from the functions at the end of this script
const { GroupedArray, getCell, getCellHash, getFieldsByName, getRecords, loopChunks, deleteTable, by } = utils();

const Basename = "Equity Applicant";
const ScreendoorTableName = "SCREENDOOR_EQUITY_APPLICANT";
const ScreendoorRevTableName = "SCREENDOOR_EQUITY_APPLICANT_REV";
const ScreendoorFields = [
//	"SUBMITTED_AT",
	"RESPONSE_ID",
	"RESPONSE_NUM",
	"RESPONSE_JSON",
	"AIRTABLE_JSON",
];
const SubmissionsTableName = Basename + " Submissions";
const SubmissionFields = {
	ID: "RESPONSE_ID",
	Num: "RESPONSE_NUM",
	SubmissionID: "SUBMISSION_ID",
	Submitted: "Submitted",
	FormulaID: "ID",
	Email: "email"
};
const ReviewsTableName = Basename + " Reviews";
const ReviewFields = {
	ID: "ID",
	MostRecent: "Most Recent Submission",
	Previous: "Previous Submissions",
	ReviewStatus: "Review Status",
	SubmissionStatus: "Submission Status",
	EquityID: "Equity Incubator ID",
};
const MetadataTableFields = [
	{
		name: "Timestamp",
		key: "timestamp",
		type: "dateTime",
		options: {
			dateFormat: {
				name: "us"
			},
			timeFormat: {
				name: "12hour"
			},
			timeZone: "America/Los_Angeles"
		}
	},
	{
		name: "Activity",
		key: "event",
		type: "richText",
	},
	{
		name: "Message",
		key: "message",
		type: "richText",
	},
	{
		name: "Response ID",
		key: "responseID",
		type: "number",
		options: {
			precision: 0
		},
	},
	{
		name: "Response Number",
		key: "responseNumber",
		type: "number",
		options: {
			precision: 0
		},
	},
	{
		name: "Equity Incubator Reviews",
		key: "",
		type: "multipleRecordLinks",
		options: {
				// we'll set this below after the user chooses a reviews table
			linkedTableId: null
		}
	},
];
const MetadataPattern = /(approved .+ edits|edited the response\.)/;

const startTime = Date.now();

const submissionsTable = base.getTable(SubmissionsTableName);
const reviewsTable = base.getTable(ReviewsTableName);

const byTimestampDesc = (a, b) => new Date(b.timestamp) - new Date(a.timestamp);
const byTimestampAsc = (a, b) => new Date(a.timestamp) - new Date(b.timestamp);

function getDataFromJSON(
	json,
	fieldMetadata,
	overrides = {})
{
	const data = JSON.parse(json);

	Object.entries(data).forEach(([key, value]) => {
		const { type } = fieldMetadata[key];

			// the JSON is coming in with bare strings for select values, so fix those
		if (type === "singleSelect") {
			data[key] = { name: value };
		} else if (type === "multipleSelects") {
			data[key] = value.map((name) => ({ name }));
		} else if (key.includes(".upload")) {
				// break the comma-delimited files into one per line
			data[key] = value.replace(/,/g, "\n");
		} else if (typeof value === "string") {
				// extra spaces at the beginning or end of some fields can cause issues, so trim them
			data[key] = value.trim();
		}
	});

	return {
		...data,
		...overrides,
	};
}

async function getImportedData(
	table)
{
	return (await getRecords(table, ScreendoorFields))
		.map((record) => {
			const [responseID, responseNumber, screendoorJSON, airtableJSON] = getCell(record, ScreendoorFields);

			if (!airtableJSON) {
					// some of the Screendoor records don't have any converted Airtable JSON associated with them, possibly
					// because they're from an old form we're not migrating.  so ignore those records.
				console.log(`Skipping empty Airtable JSON: ${i} ${record.id} ${responseID} ${submitted} ${screendoorJSON.slice(0, 200)}`);

				return null;
			}

			const screendoorData = JSON.parse(screendoorJSON);
			const overrides = {
					// this key is in the Airtable JSON, but for the revisions, it's not the ID of the original submission; it's some
					// other, unrelated ID.  but we need the original response ID to link the revisions to the originals.  so overwrite
					// the RESPONSE_ID field in the Airtable data with the one from Screendoor.  the revisions also won't have the
					// sequential_id in the JSON, so take it from the RESPONSE_NUM field in the record.
				RESPONSE_ID: responseID,
				RESPONSE_NUM: responseNumber,
					// current submissions will have a blank SUBMISSION_ID, while revisions will have a 0 in the field.  this makes
					// it possible to distinguish them when generating Form.io records.
				SUBMISSION_ID: ("initial_response_id" in screendoorData) ? "" : "0"
			};

			if (screendoorData.submitted_at) {
					// for the most recent submission, we want to store the submitted_at date, instead of updated_at, which is
					// what is currently being stored as Submitted in the Airtable JSON.  this may get further overwritten below
					// if this is a current submission that has revisions, since we'll need to get that submission date from
					// the metadata.
				overrides.Submitted = screendoorData.submitted_at;
			}

			return getDataFromJSON(airtableJSON, submissionFieldsByName, overrides);
		})
			// filter out any records with no JSON
		.filter((data) => !!data);
}

const jsonFile = await input.fileAsync(
	"Choose a .json file containing Screendoor metadata:",
	{
		allowedFileTypes: [".json", "application/json"],
	}
);

const metadataItems = jsonFile.parsedContents.sort(byTimestampAsc);
const metadataByNum = new GroupedArray();

metadataItems.forEach((item) => {
	const { responseNumber, responseID, timestamp, event } = item;

	if (MetadataPattern.test(event)) {
		metadataByNum.push(responseNumber, {
			responseNumber,
			responseID,
			event,
			timestamp,
		});
	}
});

//const deleteAllowed = await input.buttonsAsync(`Clear the ${Basename} submissions and reviews tables?`, ["Yes", "No"]);
//
//if (deleteAllowed !== "Yes") {
//	return;
//}
//
//await deleteTable(submissionsTable);
//await deleteTable(reviewsTable);

const airtableDataByNum = new GroupedArray();

const submissionFieldsByName = getFieldsByName(submissionsTable);

const screendoorTable = base.getTable(ScreendoorTableName);
const screendoorRevTable = base.getTable(ScreendoorRevTableName);
	// combine the original submissions and revisions into one list for processing
//const screendoorRecords = [
//	...(await getRecords(screendoorTable, ScreendoorFields)),
//	...(await getRecords(screendoorRevTable, ScreendoorFields)),
////	...(await screendoorTable.selectRecordsAsync({
////		fields: ScreendoorFields
////	})).records,
////	...(await screendoorRevTable.selectRecordsAsync({
////		fields: ScreendoorFields
////	})).records
//]
//		// hack the submitted date string into something parseable without moment.js, and store it with the record, so we
//		// can sort the array by the date next
//	.map((record) => ([new Date(getCell(record, ScreendoorFields[0]).replace(/([ap]m)/, " $1")), record]))
//	.sort((a, b) => b[0] - a[0]);

(await getImportedData(screendoorRevTable))
	.sort(by("Submitted"))
	.concat(await getImportedData(screendoorTable))
	.forEach((data) => airtableDataByNum.push(data.RESPONSE_NUM, data));

/*
(await getRecords(screendoorRevTable, ScreendoorFields))
	.map((record) => {
		const [responseID, responseNumber, screendoorJSON, airtableJSON] = getCell(record, ScreendoorFields);

		if (!airtableJSON) {
				// some of the Screendoor records don't have any converted Airtable JSON associated with them, possibly
				// because they're from an old form we're not migrating.  so ignore those records.
			console.log(`Skipping empty Airtable JSON: ${i} ${record.id} ${responseID} ${submitted} ${screendoorJSON.slice(0, 200)}`);

			return null;
		}

		const screendoorData = JSON.parse(screendoorJSON);

		return getDataFromJSON(airtableJSON, submissionFieldsByName, {
				// this key is in the Airtable JSON, but for the revisions, it's not the ID of the original submission; it's some
				// other, unrelated ID.  but we need the original response ID to link the revisions to the originals.  so overwrite
				// the RESPONSE_ID field in the Airtable data with the one from Screendoor.  the revisions also won't have the
				// sequential_id in the JSON, so take it from the RESPONSE_NUM field in the record.
			RESPONSE_ID: responseID,
			RESPONSE_NUM: responseNumber,
				// current submissions will have a blank SUBMISSION_ID, while revisions will have a 0 in the field.  this makes
				// it possible to distinguish them when generating Form.io records.
			SUBMISSION_ID: ("initial_response_id" in screendoorData) ? "" : "0"
		});
	})
		// filter out any records with no JSON
	.filter((data) => !!data)
	.sort(sortBy("responses_updated_at"))
	.forEach((data) => airtableDataByNum.push(data.RESPONSE_NUM, data));
*/

console.log(airtableDataByNum.getAll());

const submissions = [];

airtableDataByNum.forEach((num, items) => {
	const [firstSubmission, ...rest] = items;

	submissions.push(firstSubmission);

	if (rest.length) {
		if (!metadataByNum.has(num)) {
			console.log(num, firstSubmission, rest, submittedDates);
			throw new Error(`No metadata for response ${num}.`);
		}

		const lastSubmittedDate = metadataByNum.get(num).pop();

//		if (submittedDates.length !== rest.length) {
//			console.log(num, rest, submittedDates);
//			throw new Error("Missing metadata dates.");
//		}

		rest[rest.length - 1].Submitted = lastSubmittedDate.timestamp;
		submissions.push(...rest);
//		rest.forEach((submission) => submissions.push(submission));

//		rest.forEach((submission, i) => {
//			submission.Submitted = submittedDates[i].timestamp;
//			submissions.push(submission);
//		});
	}

	if (num == 234) {
		console.log(submissions.slice(-5));
	}
});

console.log(submissions);

return;

//screendoorRecords.forEach(([submitted, record], i) => {
//	const [responseID, responseNumber, screendoorJSON, airtableJSON] = getCell(record, ScreendoorFields);
//
//	if (!airtableJSON) {
//			// some of the Screendoor records don't have any converted Airtable JSON associated with them, possibly
//			// because they're from an old form we're not migrating.  so ignore those records.
//		console.log(`Skipping empty Airtable JSON: ${i} ${record.id} ${responseID} ${submitted} ${screendoorJSON.slice(0, 200)}`);
//
//		return null;
//	}
//
//	const screendoorData = JSON.parse(screendoorJSON);
//	const airtableData = getDataFromJSON(airtableJSON, submissionFieldsByName, {
//			// this key is in the Airtable JSON, but for the revisions, it's not the ID of the original submission; it's some
//			// other, unrelated ID.  but we need the original response ID to link the revisions to the originals.  so overwrite
//			// the RESPONSE_ID field in the Airtable data with the one from Screendoor.  the revisions also won't have the
//			// sequential_id in the JSON, so take it from the RESPONSE_NUM field in the record.
//		RESPONSE_ID: responseID,
//		RESPONSE_NUM: responseNumber,
//			// current submissions will have a blank SUBMISSION_ID, while revisions will have a 0 in the field.  this makes
//			// it possible to distinguish them when generating Form.io records.
//		SUBMISSION_ID: ("initial_response_id" in screendoorData) ? "" : "0"
//	});
//
//	const ids = {
//		responseNumber,
//		responseID,
//	};
//
//	datesByNum.push(responseNumber, {
//		...ids,
//		timestamp: submitted.toISOString(),
//		event: "SUBMITTED_AT",
//	});
//
//	if (screendoorData.submitted_at) {
//		datesByNum.push(responseNumber, {
//			...ids,
//			timestamp: screendoorData.submitted_at,
//			event: "submitted_at",
//		});
//		datesByNum.push(responseNumber, {
//			...ids,
//			timestamp: screendoorData.created_at,
//			event: "created_at",
//		});
//		datesByNum.push(responseNumber, {
//			...ids,
//			timestamp: screendoorData.updated_at,
//			event: "updated_at",
//		});
//	}
//
//	if (screendoorData.responses_updated_at) {
//		datesByNum.push(responseNumber, {
//			...ids,
//			timestamp: screendoorData.responses_updated_at,
//			event: "responses_updated_at",
//		});
//	}
//});

//console.log(datesByNum.getAll());


const submissionRecordIDsByResponse = {};

output.markdown(`Starting import of ${submissions.length} submissions...`);

await loopChunks(submissions, async (chunk) => {
	const records = await submissionsTable.createRecordsAsync(chunk);

	chunk.forEach((submission, i) => {
		const { fields: { [SubmissionFields.ID]: id } } = submission;
		const submissionRecords = (submissionRecordIDsByResponse[id] || (submissionRecordIDsByResponse[id] = []));

		submissionRecords.push({ id: records[i] });
	});
});

const reviews = [];

output.markdown(`Starting creation of ${Object.keys(submissionRecordIDsByResponse).length} reviews...`);

	// step through each set of related submissions
for (const [latestID, ...previousIDs] of Object.values(submissionRecordIDsByResponse)) {
		// get the created record for the most recent submission, so we can get any fields set by formulas
		// that we need to use when generating the review data below
	const latestRecord = await submissionsTable.selectRecordAsync(latestID.id);
	const latest = getCellHash(latestRecord, Object.values(SubmissionFields));

	reviews.push({
		fields: {
			[ReviewFields.ID]: latest.ID,
			[ReviewFields.MostRecent]: [latestID],
			[ReviewFields.Previous]: previousIDs,
			[ReviewFields.ReviewStatus]: { name: "Processed" },
			[ReviewFields.SubmissionStatus]: { name: "Equity Incubator ID assigned" },
		}
	});
}

await loopChunks(reviews, (chunk) => reviewsTable.createRecordsAsync(chunk));

output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s** at ${new Date().toLocaleString()}`);


// =======================================================================================
// these reusable utility functions can be "imported" by destructuring the functions below
// =======================================================================================

function utils() {
	const MaxChunkSize = 50;

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

		has(
			key)
		{
			return key in this.groups;
		}

		keys()
		{
			return Object.keys(this.groups);
		}

		values()
		{
			return Object.values(this.groups);
		}

		forEach(
			iterator)
		{
			Object.entries(this.groups).forEach(([key, values]) => iterator(key, values));
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
		if (typeof chunkSize === "function") {
			loopFn = chunkSize;
			chunkSize = MaxChunkSize;
		}

		const updateProgress = new Progress({
			total: items.length,
			printStep: 10
		});

			// we don't have any try/catch around the loopFn because trying to catch errors and then log what they are just
			// prints `name: "j"`, which is obviously useless (and par for the course with Airtable).  so let the inner loop
			// fail, which will print a better error message.
		for (let i = 0, len = items.length; i < len; i += chunkSize) {
			const chunk = items.slice(i, i + chunkSize);
			const result = await loopFn(chunk, i);

			updateProgress.increment(chunk.length);

			if (result === true) {
					// return true to break out of the loop early
				return;
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

	async function getRecords(
		table,
		fields = [])
	{
		return (await table.selectRecordsAsync({ fields	})).records;
	}

	async function deleteTable(
		table)
	{
		const { records } = await table.selectRecordsAsync({ fields: [] });

		output.markdown(`Deleting ${records.length} records in the **${table.name}** table.`);

		await loopChunks(records, MaxChunkSize, (chunk) => table.deleteRecordsAsync(chunk));
	}

		// adapted from https://github.com/angus-c/just/blob/master/packages/array-sort-by/index.mjs
	function by(
		iteratee)
	{
		return (a, b) => {
			const keyA = typeof iteratee === "function" ? iteratee(a) : a[iteratee];
			const keyB = typeof iteratee === "function" ? iteratee(b) : b[iteratee];

			if (typeof keyA === "string" && typeof keyB === "string") {
				const valueA = keyA.toUpperCase();
				const valueB = keyB.toUpperCase();

				if (valueA < valueB) {
					return -1;
				} else if (valueA > valueB) {
					return 1;
				} else {
					return 0;
				}
			}

			return keyA - keyB;
		};
	}

	return {
		GroupedArray,
		Progress,
		loopChunks,
		getCell,
		getCellHash,
		getFieldsByName,
		getRecords,
		deleteTable,
		by,
	};
}
