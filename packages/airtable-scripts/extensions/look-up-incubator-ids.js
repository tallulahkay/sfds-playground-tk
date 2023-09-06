const { getCellHash } = utils();

const file = await input.fileAsync(
	"Choose a .xlsx file containing Equity Incubator IDs:",
	{
		allowedFileTypes: [".xlsx"],
			// set this to false, even though we expect a header, so that each row is an array
			// of cells, instead of an object with key/value pairs
		hasHeaderRow: true
	}
);

const SubmissionsTableName = "Equity Incubator Submissions";
const SubmissionFields = [
	"businessName",
	"email",
	"phoneNumber",
	"firstName",
	"lastName",
];

const data = file.parsedContents;
const incubators = data[Object.keys(data)[0]];

const submissionsTable = base.getTable(SubmissionsTableName);
const submissionQuery = await submissionsTable.selectRecordsAsync({
	fields: SubmissionFields
});
const submissions = submissionQuery.records
	.map((record) => getCellHash(record, SubmissionFields))
	.map(({ email, ...rest }) => ({
		email: email.toLowerCase(),
		...rest
	}));
const nonmatches = [];
const idByEmail = {};
const matches = incubators.reduce((result, incubator) => {
	const incubatorEmail = incubator.email.toLowerCase();
	const match = submissions.find(({ email }) => email === incubatorEmail);

	if (match) {
		result.push(match);
		idByEmail[incubatorEmail] = incubator.id;
	} else {
		nonmatches.push(incubatorEmail);
	}

	return result;
}, []);

console.log(incubators.length, matches.length);
console.log(matches);
console.log(nonmatches);
console.log(idByEmail);

console.log(JSON.stringify(idByEmail, null, "\t"));

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

	return {
		GroupedArray,
		Progress,
		loopChunks,
		getCell,
		getCellHash,
		getFieldsByName,
	};
}
