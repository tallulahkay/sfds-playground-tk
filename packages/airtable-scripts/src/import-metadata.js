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
		return ((this.done / this.total) * 100).toFixed(1);
	}
}


const UpdateChunkSize = 50;
const TimeField = "Timestamp";
const ResponseNumField = "Response Number";
const ReviewLinkField = "Permit Reviews Metadata";
const ScreendoorNumField = "Screendoor Number";
const ReviewsTableName = "Cannabis Business Permit Reviews";

const startTime = Date.now();
const reviewsTable = base.getTable(ReviewsTableName);
const reviewsQuery = await reviewsTable.selectRecordsAsync({
	fields: [ScreendoorNumField],
});
const reviewsByNumber = {};

reviewsQuery.records.forEach((record) => {
	const number = record.getCellValue(ScreendoorNumField);

	reviewsByNumber[number] = record;
});

const metadataTable = base.getTable("Metadata");
const metadataQuery = await metadataTable.selectRecordsAsync({
	fields: [TimeField, ResponseNumField, ReviewLinkField],
	sorts: [
		{
			field: "Response Number",
			direction: "asc"
		},
		{
			field: "Timestamp",
			direction: "desc"
		}
	]
});

const updates = [];
const skippedMetadata = new Set();

metadataQuery.records
		// currently, the scraped metadata is mostly for the initial application form, but has some other
		// forms mixed in as well, so filter those out
	.filter((record) => !record.getCellValue(ReviewLinkField))
	.forEach((record) => {
		const number = record.getCellValue(ResponseNumField);
		const reviewRecord = reviewsByNumber[number];

		if (reviewRecord) {
			updates.push({
				id: record.id,
				fields: {
						// the linked record field takes an array of records to link
					"Permit Reviews Metadata": [reviewRecord]
				}
			});
		} else {
			skippedMetadata.add(number);
		}
	});

if (skippedMetadata.size > 0) {
	output.markdown(`Skipping metadata response numbers with no matching reviews in \`${ReviewsTableName}\`: ${[...skippedMetadata].join(", ")}`);
}

const metadataCount = metadataQuery.records.length;
const doneCount = metadataCount - updates.length;
const updateProgress = new Progress({
	total: metadataCount,
	done: doneCount,
	printStep: 5
});

for (let i = 0, len = updates.length; i < len; i += UpdateChunkSize) {
	const chunk = updates.slice(i, i + UpdateChunkSize);

	await metadataTable.updateRecordsAsync(chunk);
	updateProgress.increment(chunk.length);
}

output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s**`);
