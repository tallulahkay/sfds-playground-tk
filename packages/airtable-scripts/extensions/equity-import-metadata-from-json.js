const { loopChunks, deleteTable } = utils();

const Basename = "Equity Incubator";
const ReviewsTableName = Basename + " Reviews";
const MetadataTableName = Basename + " Screendoor Metadata";
const ScreendoorIDField = "RESPONSE_ID";
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
		name: ReviewsTableName,
		key: "",
		type: "multipleRecordLinks",
		options: {
				// we'll set this below after the user chooses a reviews table
			linkedTableId: null
		}
	},
];

const byTimestampDesc = (a, b) => new Date(b.timestamp) - new Date(a.timestamp);

const jsonFile = await input.fileAsync(
	"Choose a .json file containing Screendoor metadata:",
	{
		allowedFileTypes: [".json", "application/json"],
	}
);

const reviewsTable = base.getTable(ReviewsTableName);
const metadataTable = base.getTable(MetadataTableName);

const { records: existingRecords } = await metadataTable.selectRecordsAsync({ fields: [] });

if (existingRecords.length) {
	const deleteAllowed = await input.buttonsAsync(`Clear the ${MetadataTableName} table?`, ["Yes", "No"]);

	if (deleteAllowed !== "Yes") {
		return;
	}

	await deleteTable(metadataTable);
}

const startTime = Date.now();

const { records: reviewRecords } = await reviewsTable.selectRecordsAsync({
	fields: [ScreendoorIDField],
});
const reviewRecordsByID = {};

	// build a map of the review records by each one's Screendoor response ID
reviewRecords.forEach((record) => {
	const id = record.getCellValue(ScreendoorIDField);

	reviewRecordsByID[id] = record;
});

	// sort the metadata by descending date/time, so that when we link it to the review record, it'll show as newest
	// to oldest
const metadataItems = jsonFile.parsedContents.sort(byTimestampDesc);
const metadataRecords = [];
const skippedIDs = new Set();

metadataItems.forEach((item) => {
	const id = item.responseID;
	const reviewRecord = reviewRecordsByID[id];

	if (reviewRecord) {
		const fields = MetadataTableFields.reduce((result, { name, key }) => ({
			...result,
			[name]: key
				? item[key]
					// the linked record field has an empty key value, since it doesn't exist in the JSON,
					// and must be wrapped in an array
				: [reviewRecord]
		}), {});

		metadataRecords.push({ fields });
	} else {
		skippedIDs.add(id);
	}
});

if (skippedIDs.size > 0) {
	output.markdown(`Skipping metadata response IDs with no matching reviews in \`${reviewsTable.name}\`:\n\n${[...skippedIDs].join(", ")}`);
}

output.markdown(`Starting metadata import...`);

await loopChunks(metadataRecords, (chunk) => metadataTable.createRecordsAsync(chunk));

output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s**`);


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

	async function deleteTable(
		table)
	{
		const { records } = await table.selectRecordsAsync({ fields: [] });

		output.markdown(`Deleting ${records.length} records in the **${table.name}** table.`);

		await loopChunks(records, MaxChunkSize, (chunk) => table.deleteRecordsAsync(chunk));
	}

	return {
		GroupedArray,
		Progress,
		loopChunks,
		getCell,
		getCellHash,
		getFieldsByName,
		deleteTable,
	};
}
