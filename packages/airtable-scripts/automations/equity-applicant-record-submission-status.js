{

	// "import" these utilities from the functions at the end of this script
const { getCellObjectPure } = utils();
const { keys, values, fromEntries } = Object;
const zip = (a, b) => a.map((value, i) => [value, b[i]]);
const nameRange = (count, name) => Array.from(Array(count), (_, i) => i + 1).map(name);

const Basename = "Equity Applicant";
const ReviewsTableName = Basename + " Reviews";
const ActivityTableName = Basename + " Activity History";

const ReviewStatus = {
	SentForEdits: "Sent to applicant for edits",
	EditsReceived: "New edits received",
};
const DateFieldCount = 5;
	// generate a list of numbered fields, 1 to 5
const ReviewTargetFields = {
	sent: nameRange(DateFieldCount, i => `Edit - Sent to Applicant for Edits ${i} Date`),
	received: nameRange(DateFieldCount, i => `Edit - New Edits Received ${i} Date`),
};
const ReviewFields = {
	SubmissionStatus: "Submission Status",
	LastModified: "Last modified Reviews",
	LinkedSubmissionID: "SUBMISSION_ID (from Most Recent Submission)",
};
const ActivityFields = {
	ProjectID: "Project ID",
	Title: "Activity Title",
	Time: "Activity Time",
	Type: "Activity Type",
	Link: ReviewsTableName,
	Status: "Status",
	StatusType: "Status Type",
	ID: "Submission ID",
};

// TODO: pull the tables from a script config?

const { id } = input.config();
const reviewsTable = base.getTable(ReviewsTableName);
const activityTable = base.getTable(ActivityTableName);

const reviewRecord = await reviewsTable.selectRecordAsync(id);

if (reviewRecord) {
	const review = getCellObjectPure(reviewRecord, values(ReviewFields));
//	const review = getCellObject(reviewRecord, values(ReviewFields));
	const status = review[ReviewFields.SubmissionStatus].name;

console.log(review);
console.log("status", status);

	if (!values(ReviewStatus).includes(status)) {
		console.error(`Script called with unrecognized status: ${status}.`);

		return;
	}

	const lastModified = review[ReviewFields.LastModified];
		// we have to turn the date field string into an ISO string so we can write it to the sent/received fields below
//	const lastModified = parseDate(review[ReviewFields.LastModified]).toISOString();
		// link record fields return an array, even with just one link
	const [linkedID] = review[ReviewFields.LinkedSubmissionID];

console.log({
//		[ActivityFields.Title]: status.name,
		[ActivityFields.Title]: status,
		[ActivityFields.Link]: [reviewRecord],
		[ActivityFields.Time]: lastModified,
		[ActivityFields.ID]: linkedID,
		[ActivityFields.ProjectID]: reviewRecord.id,
		[ActivityFields.Type]: { name: "Status" },
		[ActivityFields.Status]: { name: status },
		[ActivityFields.StatusType]: { name: "Submission" },
	});

	await activityTable.createRecordAsync({
//		[ActivityFields.Title]: status.name,
		[ActivityFields.Title]: status,
		[ActivityFields.Link]: [reviewRecord],
		[ActivityFields.Time]: lastModified,
		[ActivityFields.ID]: linkedID,
		[ActivityFields.ProjectID]: reviewRecord.id,
		[ActivityFields.Type]: { name: "Status" },
//		[ActivityFields.Status]: status,
		[ActivityFields.Status]: { name: status },
//		[ActivityFields.Status]: { name: status.name },
		[ActivityFields.StatusType]: { name: "Submission" },
	});

	const direction = status === ReviewStatus.SentForEdits
		? "sent"
		: "received";
	const targetFields = {
		sent: getCellObjectPure(reviewRecord, ReviewTargetFields.sent),
		received: getCellObjectPure(reviewRecord, ReviewTargetFields.received),
//		sent: getCellObject(reviewRecord, ReviewTargetFields.sent),
//		received: getCellObject(reviewRecord, ReviewTargetFields.received),
	};
	const targetDirectionValues = values(targetFields[direction]);

console.log("targetDirectionValues", targetDirectionValues);

		// find the first empty field.  default to the last field if we don't find an empty one.
	const availableFieldIndex = targetDirectionValues.findIndex((value, i, array) => !value || i === array.length - 1);
	let updatedFields;

console.log(direction, availableFieldIndex, targetDirectionValues[availableFieldIndex]);

	if (!targetDirectionValues[availableFieldIndex]) {
			// there is a blank field available, so we don't have to copy and shift any other fields
		updatedFields = {
			[keys(targetFields[direction])[availableFieldIndex]]: lastModified
		};
	} else if (direction === "sent") {
			// take the 3 most recent sent fields and append the new sent date.  then take the 3 most recent received dates
			// but append a null, since we're holding that field empty for when the edits are sent back.  the goal is to have
			// the sent and received fields with the same number represent the start and end of the same transaction.
		const newValues = {
			sent: [...(values(targetFields.sent).slice(2)), lastModified],
			received: [...(values(targetFields.received).slice(2)), null],
		};
		const sentKeys = keys(targetFields.sent).slice(1);
		const receivedKeys = keys(targetFields.received).slice(1);

console.log("newValues", newValues);
console.log(values(targetFields.sent).slice(2));
console.log("keys", sentKeys, receivedKeys);

			// create a new object with updated field values.  we combine the array of values created above with an array of
			// the 2nd through 5th sent and received date labels to build the key/value pairs.
		updatedFields = {
			...fromEntries(zip(sentKeys, newValues.sent)),
			...fromEntries(zip(receivedKeys, newValues.received)),
		};
	} else {
			// there should always be an empty received edits field available, since when the form is sent for edits and
			// there is no available field, both the sent and received dates should be shifted over one, leaving an empty
			// field for the received date, when the edits come back
		throw new Error(`No empty received edits date field available for ${reviewRecord.id}, ${lastModified}`);
	}

console.log(updatedFields);

	await reviewsTable.updateRecordAsync(reviewRecord, updatedFields);

//	console.log(`Updated '${updatedFieldName}' with ${lastModified}.`);
} else {
	console.error(`Could not find Review record '${id}'.`);
}

}

// TODO: what happens if a few sent to applicant times are recorded, then the first received edits time is recorded?
//  the received time wouldn't be aligned with the most recent sent time
//  could look for the available sent time field and use the same index for the received field


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
			this.entries().forEach(([key, values]) => iterator(key, values));
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

	function getCellObject(
		record,
		fieldNames)
	{
		const result = [].concat(getCell(record, fieldNames));

		return Object.fromEntries(result.map((value, i) => [fieldNames[i], value]));
	}

	function getCellPure(
		record,
		fieldNames)
	{
		const names = [].concat(fieldNames);
		const result = names.map((name) => record.getCellValue(name));

		return result.length > 1
			? result
			: result[0];
	}

	function getCellObjectPure(
		record,
		fieldNames)
	{
		const result = [].concat(getCellPure(record, fieldNames));

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

	async function getRecordObjects(
		table,
		fieldNames)
	{
		return (await getRecords(table, fieldNames))
			.map((record) => getCellObject(record, fieldNames));
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
				// this is an Invalid Date, because the dateString wasn't parseable, so try to make it so
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

	async function confirm(
		label,
		buttons = ["Yes", "No"])
	{
		const answer = await input.buttonsAsync(label, buttons);

		return answer === buttons[0];
	}

	return {
		GroupedArray,
		Progress,
		loopChunks,
		getCell,
		getCellObject,
		getCellObjectPure,
		getFieldsByName,
		getRecords,
		getRecordObjects,
		clearTable,
		confirmClearTable,
		parseDate,
		by,
		confirm,
	};
}
