	// "import" these utilities from the functions at the end of this script
const { GroupedArray, getCell, getCellHash, getFieldsByName, getRecords, loopChunks, confirmClearTable, parseDate, by } = utils();
const { getSubmissionTableStatus, getReviewTableStatus } = status();

const Basename = "Equity Applicant";
const ScreendoorTableName = "SCREENDOOR_EQUITY_APPLICANT";
const ScreendoorRevTableName = "SCREENDOOR_EQUITY_APPLICANT_REV";
const ScreendoorFields = [
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
	NameID: "Name ID",
	Email: "email",
};
const ReviewsTableName = Basename + " Reviews";
const ReviewFields = {
	NameID: "Name ID",
	MostRecent: "Most Recent Submission",
	Previous: "Previous Submissions",
	ReviewStatus: "Review Status",
	SubmissionStatus: "Submission Status",
	SubmissionID: "Submission ID",
	ResponseID: "Screendoor Response ID",
	ResponseNum: "Screendoor Response Number",
	OriginalDate: "Original Submission Date",
};
const MetadataPattern = /(approved .+ edits|edited the response\.)/;

function getDataFromJSON(
	json,
	fieldMetadata,
	overrides = {})
{
	const data = JSON.parse(json);

	Object.entries(data).forEach(([key, value]) => {
		const { type, values } = fieldMetadata[key];

			// the JSON is coming in with bare strings for select values, so fix those.  also check that the selected options
			// exist in the field, and throw if not.
		if (type === "singleSelect") {
// TODO: fix this in the migration script
			const name = value.replace(/^others$/, "other");

			if (values && !values.includes(name)) {
				console.log(data, key, name);
				throw new Error(`Unknown option for field "${key}": "${name}"`);
			}

			data[key] = { name };
		} else if (type === "multipleSelects") {
			data[key] = value.map((name) => ({ name }));

			if (values && !value.every(name => values.includes(name))) {
				console.log(data, key, name);
				throw new Error(`Unknown option for field "${key}": "${name}"`);
			}
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
	table,
	fieldNames,
	destinationTable)
{
	const fieldMetadata = getFieldsByName(destinationTable);

	return (await getRecords(table, fieldNames))
		.map((record) => {
			const [responseID, responseNumber, screendoorJSON, airtableJSON] = getCell(record, fieldNames);

			if (!airtableJSON) {
					// some of the Screendoor records don't have any converted Airtable JSON associated with them, possibly
					// because they're from an old form we're not migrating.  so ignore those records.
				console.log(`Skipping empty Airtable JSON: ${i} ${record.id} ${responseID} ${submitted} ${screendoorJSON.slice(0, 200)}`);

				return null;
			}

			const { initial_response_id, submitted_at, labels } = JSON.parse(screendoorJSON);
			const overrides = {
					// this key is in the Airtable JSON, but for the revisions, it's not the ID of the original submission; it's some
					// other, unrelated ID.  but we need the original response ID to link the revisions to the originals.  so overwrite
					// the RESPONSE_ID field in the Airtable data with the one from Screendoor.  the revisions also won't have the
					// sequential_id in the JSON, so take it from the RESPONSE_NUM field in the record.
				RESPONSE_ID: responseID,
				RESPONSE_NUM: responseNumber,
					// we want to give current submissions a blank SUBMISSION_ID, but a 0 to revisions.  this makes
					// it possible to distinguish them when generating Form.io records.
				SUBMISSION_ID: typeof initial_response_id !== "undefined" ? "" : "0",
				...getSubmissionTableStatus(labels),
			};

			if (submitted_at) {
					// for the most recent submission, we want to store the submitted_at date, instead of updated_at, which is
					// what is currently being stored as Submitted in the Airtable JSON.  this may get further overwritten below
					// if this is a current submission that has revisions, since we'll need to get that submission date from
					// the metadata.
				overrides.Submitted = submitted_at;
			}

// TODO: maybe create this object in this function and return it so we don't need to access a global
				// the last submission to store its labels should be the most recent submission, since we're processing the
				// revisions before the submissions below
			submissionLabelsByResponse[responseID] = labels;

			return getDataFromJSON(airtableJSON, fieldMetadata, overrides);
		})
			// filter out any records with no JSON
		.filter((data) => !!data);
}

// TODO: generate the metadata records from this file and then link them to the submissions at the end.

const jsonFile = await input.fileAsync(
	"Choose a .json file containing Screendoor metadata:",
	{
		allowedFileTypes: [".json", "application/json"],
	}
);

const startTime = Date.now();

const metadataItems = jsonFile.parsedContents.sort(by(({ timestamp }) => new Date(timestamp)));
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

const submissionsTable = base.getTable(SubmissionsTableName);
const reviewsTable = base.getTable(ReviewsTableName);

if (!await confirmClearTable(submissionsTable) || !await confirmClearTable(reviewsTable)) {
	return;
}

const airtableDataByNum = new GroupedArray();

const submissionLabelsByResponse = {};
const screendoorTable = base.getTable(ScreendoorTableName);
const screendoorRevTable = base.getTable(ScreendoorRevTableName);

(await getImportedData(screendoorRevTable, ScreendoorFields, submissionsTable))
	.sort(by("Submitted"))
	.concat(await getImportedData(screendoorTable, ScreendoorFields, submissionsTable))
	.forEach((data) => airtableDataByNum.push(data.RESPONSE_NUM, data));

const submissions = [];

airtableDataByNum.forEach((num, items) => {
	const [firstSubmission, ...rest] = items;

	submissions.push({ fields: firstSubmission });

	if (rest.length) {
		if (!metadataByNum.has(num)) {
			console.log(num, firstSubmission, rest, submittedDates);
			throw new Error(`No metadata for response ${num}.`);
		}

		const lastSubmittedDate = metadataByNum.get(num).pop();

			// when there are revisions, the submission date of the "current" submission is not included in the JSON, so we
			// have to pull it from the metadata.  the last metadata date should be when the current submission was approved.
		rest.at(-1).Submitted = lastSubmittedDate.timestamp;

			// store each of the submissions on a fields key so it's ready to be used to create a new record
		submissions.push(...(rest.map((fields) => ({ fields }))));
	}
});

	// we now need to sort the submissions in descending order so that the first record in each GroupedArray value will
	// be the most recent submission when we store it in the loopChunks() below.  that way, it'll be the latestID that we
	// use to get the latest submission when creating the review record in the for loop below.  we have to dig into the
	// fields to get the date, and then call parseDate(), because the format isn't quite parseable with new Date().
submissions.sort(by(({ fields: { Submitted } }) => parseDate(Submitted), true));

const submissionRecordIDsByResponse = new GroupedArray();

output.markdown(`Starting import of ${submissions.length} submissions...`);

await loopChunks(submissions, async (chunk) => {
	const records = await submissionsTable.createRecordsAsync(chunk);

	chunk.forEach((submission, i) => {
		const { fields: { [SubmissionFields.ID]: id } } = submission;

		submissionRecordIDsByResponse.push(id, { id: records[i] });
	});
});

const reviews = [];

output.markdown(`Starting creation of ${submissionRecordIDsByResponse.keys().length} reviews...`);

	// step through each set of related submissions
for (const [latestID, ...previousIDs] of submissionRecordIDsByResponse.values()) {
		// get the created record for the most recent submission, so we can get any fields set by formulas
		// that we need to use when generating the review data below
	const latestRecord = await submissionsTable.selectRecordAsync(latestID.id);
	const latest = getCellHash(latestRecord, Object.values(SubmissionFields));
	const responseID = latest[SubmissionFields.ID];
	const labels = submissionLabelsByResponse[responseID];
	const [reviewStatus, submissionStatus] = getReviewTableStatus(labels, previousIDs.length);
	let originalSubmittedDate = latest[SubmissionFields.Submitted];

	if (previousIDs.length) {
			// with more than one record, the original submission date is from the oldest record, which is last in this array
		const oldestRecord = await submissionsTable.selectRecordAsync(previousIDs.at(-1).id);
		const oldest = getCellHash(oldestRecord, Object.values(SubmissionFields));

		originalSubmittedDate = oldest[SubmissionFields.Submitted];
	}

	reviews.push({
		fields: {
			[ReviewFields.NameID]: latest[SubmissionFields.NameID],
			[ReviewFields.MostRecent]: [latestID],
			[ReviewFields.Previous]: previousIDs,
			[ReviewFields.ReviewStatus]: reviewStatus,
			[ReviewFields.SubmissionStatus]: submissionStatus,
			[ReviewFields.SubmissionID]: latest[SubmissionFields.SubmissionID],
			[ReviewFields.ResponseID]: responseID,
			[ReviewFields.ResponseNum]: latest[SubmissionFields.Num],
			[ReviewFields.OriginalDate]: parseDate(originalSubmittedDate).toISOString(),
		}
	});
}

await loopChunks(reviews, (chunk) => reviewsTable.createRecordsAsync(chunk));

output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s** at ${new Date().toLocaleString()}`);


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
		"?: Question": ["Processing", "Sent to applicant for edits"],
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

		entries()
		{
			return Object.entries(this.groups);
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
		return table.fields.reduce((result, field) => {
			const { options } = field;

			if (options?.choices) {
					// extract the name strings from each choice so they're easier to access
				field.values = options.choices.map(({ name }) => name);
			}

			result[field.name] = field;

			return result;
		}, {});
	}

	async function getRecords(
		table,
		fields = [])
	{
		return (await table.selectRecordsAsync({ fields	})).records;
	}

	async function clearTable(
		table)
	{
		const { records } = await table.selectRecordsAsync({ fields: [] });

		output.markdown(`Deleting ${records.length} records in the **${table.name}** table.`);

		await loopChunks(records, MaxChunkSize, (chunk) => table.deleteRecordsAsync(chunk));
	}

	async function confirmClearTable(
		table)
	{
		const { records } = await table.selectRecordsAsync({ fields: [] });

		if (records.length) {
			const deleteAllowed = await input.buttonsAsync(`Clear the "${table.name}" table?`, ["Yes", "No"]);

			if (deleteAllowed !== "Yes") {
				return false;
			}

			await clearTable(table);
		}

		return true;
	}

	function parseDate(
		dateString)
	{
		let date = new Date(dateString);

		if (isNaN(date)) {
			date = new Date(dateString.replace(/([ap]m)/, " $1"));
		}

		return date;
	}


	function by(
		iteratee,
		descending)
	{
		const order = descending ? -1 : 1;

		return (a, b) => {
			const keyA = typeof iteratee === "function" ? iteratee(a) : a[iteratee];
			const keyB = typeof iteratee === "function" ? iteratee(b) : b[iteratee];
			let result;

			if (typeof keyA === "string" && typeof keyB === "string") {
				const valueA = keyA.toUpperCase();
				const valueB = keyB.toUpperCase();

				if (valueA < valueB) {
					result = -1;
				} else if (valueA > valueB) {
					result = 1;
				} else {
					result = 0;
				}
			} else {
				result = keyA - keyB;
			}

			return result * order;
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
		clearTable,
		confirmClearTable,
		parseDate,
		by,
	};
}
