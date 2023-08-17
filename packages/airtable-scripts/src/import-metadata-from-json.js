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


const UpdateChunkSize = 50;
const ScreendoorIDField = "Screendoor Response ID";
const FormNamesByID = {
	4209: "Temporary Permit",
	4225: "Article 33",
	4279: "Pre-inspection",
	4717: "Equity Application",
	6799: "Event Permit",
	5804: "Initial Application",
	5885: "Community Outreach",
	6447: "General Operations",
	5886: "General Operations",
	5887: "Security Plan",
	6162: "General Operations",
	6419: "Storefront Retail",
	6425: "Distributor",
	6437: "Cultivation",
	6420: "Delivery",
	9396: "Delivery",
	6428: "Manufacturing",
	6431: "Testing",
	6682: "Legal Help",
	8110: "Renewal",
	9026: "Renewal",
	9436: "Renewal"
};
const FormNames = [...new Set(Object.values(FormNamesByID))];
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
		name: "Form",
		key: "formID",
		type: "singleSelect",
		options: {
			choices: FormNames.map((name) => ({ name }))
		},
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
		name: "Initial Response ID",
		key: "initialID",
		type: "number",
		options: {
			precision: 0
		},
	},
	{
		name: "Review Link",
		key: "",
		type: "multipleRecordLinks",
		options: {
				// we'll set this below after the user chooses a reviews table
			linkedTableId: null
		}
	},
];

const byTimestampDesc = (a, b) => new Date(b.timestamp) - new Date(a.timestamp);

const reviewsTable = await input.tableAsync("Choose the table containing the review records:");

	// now that the user's picked the table, we can link it to the field
MetadataTableFields.find(({ name }) => name === "Review Link").options.linkedTableId = reviewsTable.id;

const metadataTableName = await input.textAsync("Enter a name for the new table to contain the Screendoor metadata:");

const metadataTableID = await base.createTableAsync(
	metadataTableName,
	MetadataTableFields.map(({ name, type, options }) => ({ name, type, options }))
);
const metadataTable = await base.getTable(metadataTableID);

const jsonFile = await input.fileAsync(
	"Choose a .json file containing Screendoor metadata:",
	{
		allowedFileTypes: [".json", "application/json"],
	}
);

const startTime = Date.now();
const reviewsQuery = await reviewsTable.selectRecordsAsync({
	fields: [ScreendoorIDField],
});
const reviewsByID = {};

	// build a map of the review records by each one's Screendoor response ID
reviewsQuery.records.forEach((record) => {
	const id = record.getCellValue(ScreendoorIDField);

	reviewsByID[id] = record;
});

	// sort the metadata by descending date/time, so that when we link it to the review record, it'll show as newest
	// to oldest
const metadataItems = jsonFile.parsedContents.sort(byTimestampDesc);
const metadataRecords = [];
const skippedIDs = new Set();

metadataItems.forEach((item) => {
	const { responseID, initialID } = item;
		// submissions that are linked to the initial business application with have an initialID number set.  if that
		// value is null, then this metadata is from the initial application submission itself, so use its responseID.
	const id = initialID ?? responseID;
	const reviewRecord = reviewsByID[id];

	if (reviewRecord) {
		const fields = MetadataTableFields.reduce((result, { name, key }) => ({
			...result,
			[name]: key === "formID"
					// the Form field is a singleSelect and requires the name to be passed in an object
				? { name: FormNamesByID[item.formID] }
				: key
					? item[key]
						// the linked record field has an empty key value, since it doesn't exist in the JSON,
						// and must be wrapped in an array
					: [reviewRecord]
		}), {});

		if (fields.Form.name) {
			metadataRecords.push({ fields });
		} else {
			console.error(`Unrecognized form ID: ${item.formID}\n${JSON.stringify(fields, null, 2)}`);
		}
	} else {
		skippedIDs.add(id);
	}
});

if (skippedIDs.size > 0) {
	output.markdown(`Skipping metadata response IDs with no matching reviews in \`${reviewsTable.name}\`:\n\n${[...skippedIDs].join(", ")}`);
}

output.markdown(`Starting metadata import...`);

const updateProgress = new Progress({
	total: metadataRecords.length,
		// print the progress every 4%
	printStep: 4
});

for (let i = 0, len = metadataRecords.length; i < len; i += UpdateChunkSize) {
	const chunk = metadataRecords.slice(i, i + UpdateChunkSize);

	try {
		await metadataTable.createRecordsAsync(chunk);
		updateProgress.increment(chunk.length);
	} catch (e) {
		console.error(e);
		console.log("Bad chunk", i, chunk);
	}
}

output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s**`);
