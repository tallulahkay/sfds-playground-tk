{

	// "import" these utilities from the functions at the end of this script
const { getCellObject, getFieldNames, chain } = utils();
const { keys, values, fromEntries } = Object;

const zip = (a, b) => a.map((value, i) => [value, b[i]]);
const nameRange = (count, name) => Array.from(Array(count), (_, i) => i + 1).map(name);
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const Basename = "Cannabis Business Permit";
const ReviewsTableName = Basename + " Reviews";
const ActivityTableName = "Activity History";

const ReviewStatus = {
	Sent: "Sent to applicant for edits",
	Received: "New edits received",
};
const ReviewStatusStrings = values(ReviewStatus);
const DateFieldCount = 5;
const ReviewFields = {
	LastModified: "Last Modified - Reviews",
	LinkedSubmissionID: "SUBMISSION_ID (from Initial Application - Latest Submission)",
	ActivityRecords: "Activity History",
	Address: "Address",
	JSON: "Previous Status JSON",
};
const StatusFieldMappings = {
	"Initial Application": "Initial Application",
	"Community Outreach": "Community Outreach",
	"General Operations": "General Ops",
	"Security Plan": "Security",
	"Storefront Retail": "Storefront Retail",
	"Delivery": "Delivery",
	"Distributor": "Distributor",
	"Manufacturing": "Manufacturing",
	"Testing": "Testing",
	"Cultivation": "Cultivation",
	"Business Ownership": "Business Ownership"
};
const StatusFieldNames = keys(StatusFieldMappings).map(name => `${name} Status`);
// TODO: do we need to get all these fields, if we call getCellObject with just the changed date fields below for targetFields?
const ReviewFieldPattern = new RegExp([
	...values(ReviewFields),
	...StatusFieldNames,
	"sent to",
	"New Edits",
].map(escapeRegExp).join("|"), "i");
const ActivityFields = {
	ProjectID: "Project ID",
	Title: "Activity Title",
	Time: "Activity Time",
	Type: "Activity Type",
	Link: ReviewsTableName,
	Form: "Form",
	StatusType: "Status Type",
	NewStatus: "New Status",
	ID: "Submission ID",
};
const AddressFilter = /test/i;

const isEditStatus = (status) => ReviewStatusStrings.includes(status);

// TODO: add option to not log the times of each function in the chain?
await chain([
	init,
	createStatusChangeDateUpdates,
	console.log,
	insertActivityRecord,
	console.log,
	updateReview,
]);

async function init(
	context)
{
		// this is the ID of the review record that changed and caused the automation to run
	const { id } = input.config();
	const reviewsTable = base.getTable(ReviewsTableName);
	const reviewTableFields = getFieldNames(reviewsTable, ReviewFieldPattern);
	const reviewRecord = await reviewsTable.selectRecordAsync(id);

	if (!reviewRecord) {
		throw new Error(`Could not find Review record '${id}'.`);
	}

	return {
		...context,
		reviewsTable,
		reviewRecord,
		review: getCellObject(reviewRecord, reviewTableFields)
	};
}

async function createStatusChangeDateUpdates(
	context)
{
	const { review, reviewRecord } = context;
// TODO: add try/catch
	const previousValues = JSON.parse(review[ReviewFields.JSON] || "{}");
	const changedFields = StatusFieldNames.filter((name) => {
		const current = review[name];
		const previous = previousValues[name];

		return isEditStatus(current) && current !== previous;
	});

	if (!changedFields.length) {
			// the automation is triggered whenever any of the fields it's watching change to any status, but we only care
			// about the sent and received statuses.  so if we haven't found any changes, just bail.
		console.log("No sent/received status changes detected.");

		return true;
	} else if (changedFields.length > 1) {
		console.error(`Multiple changed fields detected:\n${changedFields.join("\n")}`);
// TODO: do we need to log all these changes in this case?  normally shouldn't happen
	}

	const [changedStatusField] = changedFields;

	if (!changedStatusField) {
		throw new Error(`Bad changedStatusName: ${changedStatusField}`);
	}

	const targetBaseName = StatusFieldMappings[changedStatusField.replace(" Status", "")];
	const targetFieldNames = {
		sent: nameRange(DateFieldCount, i => `${targetBaseName} - Sent to Applicant for Edits ${i} Date`),
		received: nameRange(DateFieldCount, i => `${targetBaseName} - New Edits Received ${i} Date`),
	};
	const status = review[changedStatusField];

console.log(changedFields, changedStatusField, targetBaseName, status);

	if (!isEditStatus(status)) {
		throw new Error(`Unrecognized status: ${status}.`);
	}

// TODO: remove this filter
	if (!AddressFilter.test(review.Address)) {
		console.error(`Skipping non-test address: ${review.Address}`);

		return true;
	}

	const direction = status === ReviewStatus.Sent
		? "sent"
		: "received";
	const targetFields = {
		sent: getCellObject(reviewRecord, targetFieldNames.sent),
		received: getCellObject(reviewRecord, targetFieldNames.received),
	};
	const targetDirectionValues = values(targetFields[direction]);
		// find the first empty field.  default to the last field if we don't find an empty one.
	const availableFieldIndex = targetDirectionValues.findIndex((value, i, array) => !value || i === array.length - 1);
	const lastModified = review[ReviewFields.LastModified];
	let updatedFields;

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

		// add the new activity record at the beginning of the link list in the review record, so that the activity events
		// appear newest to oldest in the interface
//	updatedFields[ReviewFields.ActivityRecords] = [{ id: newActivityID }, ...linkedActivityRecords];

	previousValues[changedStatusField] = status;
	updatedFields[ReviewFields.JSON] = JSON.stringify(previousValues, null, "\t");

	return {
		...context,
		status,
		updatedFields,
		changedStatusField,
	};
}

async function insertActivityRecord(
	context)
{
	const { status, review, reviewRecord, updatedFields, changedStatusField } = context;
	const activityTable = base.getTable(ActivityTableName);

		// link record fields return an array, even with just one link
// TODO: this ID needs to be the actual changed status field name
	const [linkedSubmissionID] = review[ReviewFields.LinkedSubmissionID];
// TODO: sometimes we do need an object returned from getCellObject()
	const linkedActivityRecords = reviewRecord.getCellValue(ReviewFields.ActivityRecords) || [];
	//const linkedActivityRecords = review[ReviewFields.ActivityRecords];

	console.log(linkedActivityRecords);

	const newActivityID = await activityTable.createRecordAsync({
// TODO: fix activity title
		[ActivityFields.Title]: `${changedStatusField} changed to: ${status}`,
		[ActivityFields.Link]: [reviewRecord],
		[ActivityFields.Time]: review[ReviewFields.LastModified],
		[ActivityFields.ID]: linkedSubmissionID,
		[ActivityFields.ProjectID]: reviewRecord.id,
		[ActivityFields.Form]: { name: "Initial Application" },
		[ActivityFields.Type]: { name: "Status" },
	//	[ActivityFields.NewStatus]: { name: status },
		[ActivityFields.StatusType]: { name: "Submission" },
	});

		// add the new activity record at the beginning of the link list in the review record, so that the activity events
		// appear newest to oldest in the interface
	updatedFields[ReviewFields.ActivityRecords] = [{ id: newActivityID }, ...linkedActivityRecords];
}

async function updateReview(
	context)
{
	const { reviewsTable, reviewRecord, updatedFields } = context;

	await reviewsTable.updateRecordAsync(reviewRecord, updatedFields);
}

}

// TODO: what happens if a few sent to applicant times are recorded, then the first received edits time is recorded?
//  the received time wouldn't be aligned with the most recent sent time
//  could look for the available sent time field and use the same index for the received field


// ====================================================================================================================
// these reusable utility functions can be "imported" by destructuring the functions below
// ====================================================================================================================

function utils() {
	const MaxChunkSize = 50;

	class GroupedArray {
		constructor(
			initialData = {})
		{
			this.data = { ...initialData };
		}

		push(
			key,
			value)
		{
			const arr = this.data[key] || (this.data[key] = []);

			arr.push(value);
		}

		get(
			key)
		{
			return this.data[key];
		}

		getAll()
		{
			return this.data;
		}

		has(
			key)
		{
			return key in this.data;
		}

		keys()
		{
			return Object.keys(this.data);
		}

		values()
		{
			return Object.values(this.data);
		}

		entries()
		{
			return Object.entries(this.data);
		}

		forEach(
			iterator)
		{
			this.entries().forEach(([key, values]) => iterator(key, values));
		}

		map(
			iterator)
		{
			return this.entries().map(([key, values]) => iterator(key, values));
		}
	}

	class DefaultMap extends GroupedArray {
		constructor(
			defaultGenerator,
			initialData)
		{
			super(initialData);
			this.defaultGenerator = /^class\s/.test(String(defaultGenerator))
				? () => new defaultGenerator()
				: defaultGenerator;
		}

		get(
			key)
		{
			if (!(key in this.data)) {
				this.data[key] = this.defaultGenerator(key);
			}

			return this.data[key];
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
		const result = names.map((name) => {
			let value = record.getCellValue(name);

			if (value && typeof value === "object") {
				value = record.getCellValueAsString(name);
			}

			return value;
		});

		return result.length > 1
			? result
			: result[0];
	}

	function getCellObject(
		record,
		fieldNames)
	{
		const result = [].concat(getCell(record, fieldNames));

		return Object.fromEntries([
			["_id", record.id],
			...result.map((value, i) => [fieldNames[i], value])
		]);
	}

	function getFieldsByName(
		table)
	{
		return table.fields.reduce((result, field) => {
			const { options } = field;

			if (options?.choices) {
					// extract the name strings from each choice so they're easier to access
				field.choices = options.choices.map(({ name }) => name);
			}

			result[field.name] = field;

			return result;
		}, {});
	}

	function getFieldNames(
		table,
		filterPattern)
	{
		let names = table.fields.map(({ name }) => name);

		if (filterPattern instanceof RegExp) {
			names = names.filter((name) => filterPattern.test(name));
		}

		return names;
	}

	async function getRecords(
		table,
		fields = [])
	{
		return (await table.selectRecordsAsync({ fields	})).records;
	}

	async function getRecordObjects(
		table,
		fieldNames = table.fields.map(({ name }) => name))
	{
		if (fieldNames instanceof RegExp) {
			const pattern = fieldNames;

			fieldNames = table.fields
				.map(({ name }) => name)
				.filter((name) => pattern.test(name));
		}

		return (await getRecords(table, fieldNames))
			.map((record) => getCellObject(record, fieldNames));
	}

	async function clearTable(
		table)
	{
		const { records } = await table.selectRecordsAsync({ fields: [] });

		await output.markdown(`Deleting **${records.length}** records in the **${table.name}** table.`);

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

	const [timeStart, timeEnd] = (() => {
		const times = {};
			// the output API isn't available in an automation script
		const print = output?.markdown || console.log;

		function timeStart(
			name = "timer")
		{
			times[name] = Date.now();
		}

		function timeEnd(
			name = "timer")
		{
			const startTime = times[name];

			if (startTime) {
				const totalTime = Date.now() - startTime;
				const totalTimeString = totalTime > 1000
					? (totalTime / 1000).toFixed(2) + "s"
					: totalTime + "ms";

				print(`**${name}** took **${totalTimeString}**.`);
				delete times[name];
			} else {
				print(`Timer called **${name}** not found.`);
			}
		}

		return [timeStart, timeEnd];
	})();

	async function chain(
		context,
		fns)
	{
		if (Array.isArray(context)) {
			fns = context;
			context = {};
		}

		const chainName = `${fns.length}-function chain`;
		let lastFnName = "";

		timeStart(chainName);

		for (const fn of fns) {
			if (typeof fn !== "function") {
				continue;
			} else if (fn === console.log) {
				console.log(`Context after ${lastFnName}:\n`, context);
				continue;
			}

			lastFnName = fn.name;
			timeStart(fn.name);

			const result = await fn(context);

			timeEnd(fn.name);

			if (result === true) {
				break;
			} else if (result && typeof result === "object") {
				context = result;
			}
		}

		timeEnd(chainName);

		return context;
	}

	return {
		GroupedArray,
		DefaultMap,
		Progress,
		loopChunks,
		getCell,
		getCellObject,
		getFieldsByName,
		getFieldNames,
		getRecords,
		getRecordObjects,
		clearTable,
		confirmClearTable,
		parseDate,
		by,
		confirm,
		timeStart,
		timeEnd,
		chain,
	};
}
