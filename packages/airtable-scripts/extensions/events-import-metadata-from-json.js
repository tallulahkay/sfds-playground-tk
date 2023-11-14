const { by, loopMegaChunks, confirmClearTable, getTable } = utils();

const Basename = "Event Permit";
const ReviewsTableName = Basename + " Reviews";
const MetadataTableName = "Screendoor Metadata";
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
		type: "singleLineText",
	},
	{
		name: "Response Number",
		key: "responseNumber",
		type: "singleLineText",
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

const reviewsTable = getTable(ReviewsTableName);
let metadataTable = getTable(MetadataTableName);

if (!metadataTable) {
	MetadataTableFields.find(({ name }) => name === ReviewsTableName).options.linkedTableId = reviewsTable.id;

	const metadataTableID = await base.createTableAsync(
		MetadataTableName,
		MetadataTableFields.map(({ name, type, options }) => ({ name, type, options }))
	);

	metadataTable = await base.getTable(metadataTableID);
} else if (!confirmClearTable(metadataTable)) {
	return;
}

const jsonFile = await input.fileAsync(
	"Choose a .json file containing Screendoor metadata:",
	{
		allowedFileTypes: [".json", "application/json"],
	}
);

const startTime = Date.now();

//const { records: reviewRecords } = await reviewsTable.selectRecordsAsync({
//	fields: [ScreendoorIDField],
//});
//const reviewRecordsByID = {};

//	// build a map of the review records by each one's Screendoor response ID
//reviewRecords.forEach((record) => {
//	const id = record.getCellValue(ScreendoorIDField);
//
//	reviewRecordsByID[id] = record;
//});

	// sort the metadata by descending date/time, so that when we link it to the review record, it'll show as newest
	// to oldest
const metadataItems = jsonFile.parsedContents.sort(by("timestamp", true));
const metadataRecords = [];
const skippedIDs = new Set();

console.log(metadataItems);

metadataItems.forEach((item) => {
//	const id = item.responseID;
//	const reviewRecord = reviewRecordsByID[id];

		const fields = MetadataTableFields.reduce((result, { name, key }) => ({
			...result,
			[name]: key
					// all the metadata fields in this table are strings, so convert the value
				? String(item[key])
					// the linked record field has an empty key value, since it doesn't exist in the JSON,
					// and must be wrapped in an array
				: null
		}), {});

		metadataRecords.push({ fields });
});
//metadataItems.forEach((item) => {
//	const id = item.responseID;
//	const reviewRecord = reviewRecordsByID[id];
//
//	if (reviewRecord) {
//		const fields = MetadataTableFields.reduce((result, { name, key }) => ({
//			...result,
//			[name]: key
//				? item[key]
//					// the linked record field has an empty key value, since it doesn't exist in the JSON,
//					// and must be wrapped in an array
//				: [reviewRecord]
//		}), {});
//
//		metadataRecords.push({ fields });
//	} else {
//		skippedIDs.add(id);
//	}
//});

if (skippedIDs.size > 0) {
	output.markdown(`Skipping metadata response IDs with no matching reviews in \`${reviewsTable.name}\`:\n\n${[...skippedIDs].join(", ")}`);
}

output.markdown(`Starting metadata import...`);

await loopMegaChunks(metadataRecords, (chunk) => metadataTable.createRecordsAsync(chunk));

output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s**`);


// ====================================================================================================================
// these reusable utility functions can be "imported" by destructuring the functions below
// ====================================================================================================================

function utils() {
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

	const { loopChunks, loopMegaChunks } = (() => {
		const MaxChunkSize = 50;
			// this is supposed to be 15, but it seems like Airtable throws an exception when the recent async request count
			// gets to 15, so limit it to something smaller
		const MaxPromiseAll = 14;

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

		const lastSecond = {
			times: [],

			add()
			{
				this.times.push(Date.now());
			},

			count()
			{
				const lastSec = Date.now() - 1000;

				this.times = this.times.filter(t => t > lastSec);

				return this.times.length;
			}
		};

		async function loopMegaChunks(
			items,
			loopFn)
		{
			const updateProgress = new Progress({
				total: items.length,
				printStep: 10
			});
			const len = items.length;
			const promises = [];
			let promisedItemCount = 0;
			let i = 0;

			while (i < len) {
					// in most cases, these will be the same, but just in case a previous call to loopMegaChunks() recently
					// finished, track both previously triggered async calls and the current ones, whichever is larger
				if (Math.max(lastSecond.count(), promises.length) < MaxPromiseAll) {
					const chunk = items.slice(i, i + MaxChunkSize);
					const result = loopFn(chunk, i);

					lastSecond.add();

					if (result === true) {
							// if loopFn returns true instead of a promise, break out of the loop
						return;
					}

					promises.push(result);
					promisedItemCount += chunk.length;
					i += chunk.length;
				} else {
					const results = await Promise.all(promises);

					updateProgress.increment(promisedItemCount);
					promises.length = 0;
					promisedItemCount = 0;

					if (results.some((res) => res === true)) {
							// if any of the promises resolves to a true, break out of the loop
						return;
					}
				}
			}

			if (promises.length) {
				await Promise.all(promises);
				updateProgress.increment(promisedItemCount);
			}
		}

		return { loopChunks, loopMegaChunks };
	})();

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

		await loopMegaChunks(records, (chunk) => table.deleteRecordsAsync(chunk));
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

	function getTable(
		tableName)
	{
			// calling base.getTable() with a name that doesn't exist in the base throws an exception, because of course.  so
			// find the table via name and return it, or undefined if it's not there.
		return base.tables.find(({ name }) => name === tableName);
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

				output.markdown(`**${name}** took **${totalTimeString}**.`);
				delete times[name];
			} else {
				output.markdown(`Timer called **${name}** not found.`);
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
		loopMegaChunks,
		getCell,
		getCellObject,
		getFieldsByName,
		getFieldNames,
		getRecords,
		getRecordObjects,
		clearTable,
		confirmClearTable,
		getTable,
		parseDate,
		by,
		confirm,
		timeStart,
		timeEnd,
		chain,
	};
}
