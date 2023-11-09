{

	// "import" these utilities from the functions at the end of this script
const { GroupedArray, getFieldsByName, getRecordObjects, loopMegaChunks, by, chain } = utils();
const { values, entries, fromEntries } = Object;

const Basename = "Cannabis Business Permit";
const ScreendoorTableName = "SCREENDOOR_BUSINESS_PERMIT";
const ScreendoorFields = [
	"RESPONSE_ID",
	"RESPONSE_NUM",
	"INITIAL_RESPONSE_ID",
	"ARCHIVED_ID",
	"RESPONSE_JSON",
	"AIRTABLE_JSON",
	"AIRTABLE_JSON_BO",
	"SUBMITTED_AT",
	"SCREENDOOR_FORM_ID",
];
const SubmissionFields = {
	ID: "RESPONSE_ID",
	Num: "RESPONSE_NUM",
	SubmissionID: "SUBMISSION_ID",
	ProjectID: "PROJECT_ID",
	Submitted: "Submitted",
	Email: "email",
	AcceptedLink: "Renewal - Accepted Submissions",
	LatestLink: "Renewal - Latest Submission",
	PrevousLink: "Renewal - Previous Submissions",
};
const ReviewsTableName = Basename + " Reviews";
const ReviewFields = {
	MostRecent: "Initial Application - Latest Submission",
	Previous: "Initial Application - Previous Submissions",
	SubmissionID: "Initial Application Submission ID",
	InitialID: "Initial Response ID",
	ResponseNum: "Initial Application Screendoor Number",
	OriginalDate: "Project Submission Date",
	Status: "Project Status",
	ProjectID: "Project ID",
};
const Forms = [
	["4209", "Temporary Permit"],
	["4225", "Article 33"],
	["4279", "Pre-inspection"],
	["4717", "Equity Applicant", "ea"],
	["4718", "Equity Incubator", "ea"],
	["5804", "Initial Application", "biz", "IA"],
	["5804BO", "Business Ownership", "biz", "BO"],
	["5885", "Community Outreach", "biz", "CO"],
	["6447", "General Operations", "biz", "GO"],
	["5886", "General Operations", "biz", "GO"],
	["5887", "Security Plan", "biz", "Sec"],
	["6162", "General Operations", "biz", "GO"],
	["6419", "Storefront Retail", "biz", "SR"],
	["6425", "Distributor", "biz", "Dis"],
	["6437", "Cultivation", "biz", "Cult"],
	["6420", "Delivery", "biz", "Del"],
	["6428", "Manufacturing", "biz", "Mfg"],
	["6431", "Testing", "biz", "Test"],
	["6682", "Legal Help"],
	["6799", "Event Permit"],
	["8110", "Annual Renewal", "ren", "Ren1"],
	["9026", "Annual Renewal", "ren", "Ren2"],
	["9436", "Annual Renewal", "ren", "Ren3"]
].reduce((result, [id, name, base, shortName]) => {
	const info = { id, name, base, shortName };

	result[id] = result[name] = info;
	shortName && (result[shortName] = info);

	return result;
}, {
	info(base)
	{
		const baseString = base === "part2" ? "biz" : base;
		let info = values(this)
			.filter((form) => form.base === baseString);

		if (base === "part2") {
				// treat IA as part 1, and everything else, including BO, as part 2
			info = info.filter(({ name }) => name !== this.IA.name);
		}

		return info;
	},

	names(base)
	{
			// make sure the names are unique
		return [...new Set(this.info(base).map(({ name }) => name))];
	},
});
const MetadataTableName = "Screendoor Metadata";
const StringFieldTypes = [
	"singleLineText",
	"multilineText",
	"richText",
	"email",
	"phoneNumber",
	"url",
];

const startTime = Date.now();

await output.markdown(`Starting at **${new Date().toLocaleString()}**`);

const result = await chain(
	[
		init,
		getReviewRecordsByInitialID,
		convertJSONToAirtableData,
		createSubmissions,
	]
);

console.log(result);

await output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s** at **${new Date().toLocaleString()}**`);

// ====================================================================================================================
// init the context
// ====================================================================================================================

async function init(
	context)
{
	const submissionsTablesByFormID = fromEntries(Forms.info("ren")
		.map(({ id, name }) => [id, base.getTable(name + " Submissions")]));

	return {
		...context,
		submissionsTablesByFormID,
		submissionsTableMetadataByFormID: fromEntries(entries(submissionsTablesByFormID)
			.map(([formID, table]) => [formID, getFieldsByName(table)])),
		submissionsTable: [...new Set(values(submissionsTablesByFormID))][0],
		reviewsTable: base.getTable(ReviewsTableName),
		metadataTable: base.getTable(MetadataTableName)
	};
}

// ====================================================================================================================
// fill reviewRecordsByInitialID from the existing reviews
// ====================================================================================================================

async function getReviewRecordsByInitialID(
	context)
{
	const { reviewsTable } = context;
	const reviews = await getRecordObjects(reviewsTable, values(ReviewFields));
	const reviewRecordsByInitialID = fromEntries(reviews.map((review) => [review[ReviewFields.InitialID], review]));

	return {
		...context,
		reviewRecordsByInitialID,
	};
}

// ====================================================================================================================
// convert AIRTABLE_JSON fields to Airtable record data
// ====================================================================================================================

async function convertJSONToAirtableData(
	context)
{
	const { submissionsTableMetadataByFormID, reviewRecordsByInitialID } = context;
	const screendoorTable = base.getTable(ScreendoorTableName);
	const airtableDataByInitialID = new GroupedArray();
	const fieldNameMappings = getNameMappings();
	const allowedFormIDs = Forms.info("ren").map(({ id }) => id);

	function getSelectFromName(
		name)
	{
			// don't convert falsy, non-zero values to a name object; just return null instead, which is a valid option
		return name || name === 0
			? { name }
			: null;
	}

	function getDataFromJSON(
		json,
		fieldMetadata,
		overrides = {})
	{
		let data = json;

		if (typeof json === "string") {
			try {
				data = JSON.parse(json);
			} catch (e) {
					// in case the JOSN field was accidentally edited, log the string so we can find it
				console.error(json);
				throw e;
			}
		}

		entries(data).forEach(([key, value]) => {
			const mappedKey = fieldNameMappings[key];

			if (mappedKey) {
					// this JSON is using an old Airtable field name, so map it to the new one
				data[mappedKey] = data[key];
				delete data[key];

					// use the updated key for the rest of this loop, so that we'll check the remapped value in fieldMetadata
				key = mappedKey;
			}

			if (!(key in fieldMetadata)) {
				console.error(`Unknown key: ${key} ${data.RESPONSE_NUM} ${data.email}`);
// TODO: this should probably throw to stop the processing instead of skipping a key and losing the data

				return;
			} else if (key === "SCREENDOOR_BUSINESS_PERMIT") {
					// some tables have this field, and some don't, but none of them seem to need it, so just delete it so that
					// it doesn't cause any errors
				delete data[key];

				return;
			}

			const { type, choices } = fieldMetadata[key];

				// the JSON is coming in with bare strings for select choices, so fix those.  also check that the selected options
				// exist in the field, and throw if not.
			if (type === "singleSelect") {
				if (value && choices && !choices.includes(value)) {
					console.error(data);
					throw new Error(`Unknown option for single-select field "${key}": "${value}"`);
				}

				data[key] = getSelectFromName(value);
			} else if (type === "multipleSelects" && value) {
					// the value for a multipleSelects needs to be in an array, and not all form mappings seem to provide that,
					// so make sure it's wrapped (but only if it's not null)
				const valueArray = [].concat(value);

				if (choices && !valueArray.every(name => !name || choices.includes(name))) {
					const unknownOptions = valueArray.filter((name) => !choices.includes(name));

					console.error(data);
					throw new Error(`Unknown option for multi-select field "${key}": "${unknownOptions}"`);
				}

					// make sure that the array of values is unique, since Airtable will complain otherwise
				data[key] = [...new Set(valueArray)].map((name) => getSelectFromName(name));
			} else if (type === "multipleRecordLinks") {
				data[key] = value.map((id) => ({ id }));
			} else if (StringFieldTypes.includes(type)) {
					// extra spaces at the beginning or end of some fields can cause issues, so trim them
				data[key] = value == undefined
					? ""
					: String(value).trim();
			}
		});

		return {
			...data,
			...overrides,
		};
	}

	(await getRecordObjects(screendoorTable, ScreendoorFields))
		.filter(({ AIRTABLE_JSON, SCREENDOOR_FORM_ID }) => AIRTABLE_JSON && allowedFormIDs.includes(SCREENDOOR_FORM_ID))
		.sort(by("SUBMITTED_AT"))
		.forEach(({
			RESPONSE_ID,
			RESPONSE_NUM,
			INITIAL_RESPONSE_ID,
			AIRTABLE_JSON,
			SCREENDOOR_FORM_ID: formID
		}) => {
			const initialID = INITIAL_RESPONSE_ID ?? RESPONSE_ID;
			const tableMetadata = submissionsTableMetadataByFormID[formID];
			const review = reviewRecordsByInitialID[initialID];
			const overrides = {
				RESPONSE_ID: String(initialID),
				RESPONSE_NUM: RESPONSE_NUM,
				[SubmissionFields.ProjectID]: String(review[ReviewFields.ProjectID])
			};

			airtableDataByInitialID.push(initialID,
				getDataFromJSON(AIRTABLE_JSON, tableMetadata, overrides));
		});

	return {
		...context,
		airtableDataByInitialID,
	};
}

// ====================================================================================================================
// create renewal submissions
// ====================================================================================================================

async function createSubmissions(
	context)
{
	const { airtableDataByInitialID, submissionsTable, reviewRecordsByInitialID } = context;

	airtableDataByInitialID.forEach((initialID, items) => {
		const reviewRecord = [{ id: reviewRecordsByInitialID[initialID]._id }];

			// sort descending by submission date, so the most recent renewal is first
		items.sort(by("Submitted", true));
		items.forEach((item, i) => {
				// all of the renewal submissions imported from Screendoor are considered "accepted", since we don't have any
				// revision data for them
			item[SubmissionFields.AcceptedLink] = reviewRecord;

				// we want the first, most recent, renewal to have an empty SUBMISSION_ID so it gets a Form.io record created
				// for it, while earlier years should be ignored
			item[SubmissionFields.SubmissionID] = i ? "0" : "";
		});
	});

		// create a flat list of all submissions, each with a fields key for createRecordsAsync()
	const submissions = airtableDataByInitialID.values()
		.flat()
		.map((fields) => ({ fields }));

	const recordIDsByResponseID = new GroupedArray();

	await output.markdown(`Starting import of **${submissions.length}** submissions for **${Forms.Ren1.name}**...`);

	await loopMegaChunks(submissions, async (chunk) => {
		const records = await submissionsTable.createRecordsAsync(chunk);

		chunk.forEach((submission, i) => {
			const { fields: { [SubmissionFields.ID]: responseID } } = submission;

			recordIDsByResponseID.push(responseID, { id: records[i] });
		});
	});

	return {
		...context,
		recordIDsByResponseID,
	};
}

}

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
		parseDate,
		by,
		confirm,
		timeStart,
		timeEnd,
		chain,
	};
}

function getNameMappings() {
	const mappings = {
		"ownershipDocument1": "ownershipDocument.1.ownershipDocument1.{UPLOAD}.1",
		"ownershipDocument2": "ownershipDocument.2.ownershipDocument1.{UPLOAD}.1",
		"ownershipDocument3": "ownershipDocument.3.ownershipDocument1.{UPLOAD}.1",
		"whatIsYourEquityIncubatorNumber": "equityIncubatorNumber",
		"equityAgreement": "equityAgreement.{UPLOAD}.1",
		"additionalContact1.fullName": "additionalContact.1.fullName",
		"additionalContact1.email": "additionalContact.1.email",
		"additionalContact1.phone": "additionalContact.1.phone",
		"additionalContact2.fullName": "additionalContact.2.fullName",
		"additionalContact2.email": "additionalContact.2.email",
		"additionalContact2.phone": "additionalContact.2.phone",
		"hoursOfOperation": "operationHours",
		"numberOfRetailLocations": "numberRetailLocations",
		"bpa": "hasBPA",
		"cua": "hasCUA",
		"planningDocs": "hasPlanningDocs",
		"planningDocUpload": "planningDocUpload.{UPLOAD}.1",
		"uploadTitleOrDeed": "uploadTitleOrDeed.{UPLOAD}.1",
		"lease": "lease.{UPLOAD}.1",
		"landlordActivityAuthorization": "landlordActivityAuthorization.{UPLOAD}.1",
		"buyLOI": "buyLOI.{UPLOAD}.1",
		"rentLOI": "rentLOI.{UPLOAD}.1",
		"vacant": "isVacant",
		"businessFormation": "businessFormation.{UPLOAD}.1",
		"businessOwnerConvictionInformation1.uploadRehabilitationDocs": "businessOwnerConvictionInformation1.uploadRehabilitationDocs.{UPLOAD}.1",
		"businessOwnerConvictionInformation2.uploadRehabilitationDocs": "businessOwnerConvictionInformation2.uploadRehabilitationDocs.{UPLOAD}.1",
		"businessOwnerConvictionInformation3.uploadRehabilitationDocs": "businessOwnerConvictionInformation3.uploadRehabilitationDocs.{UPLOAD}.1",
		"businessOwnerConvictionInformation4.uploadRehabilitationDocs": "businessOwnerConvictionInformation4.uploadRehabilitationDocs.{UPLOAD}.1",
		"businessOwnerConvictionInformation5.uploadRehabilitationDocs": "businessOwnerConvictionInformation5.uploadRehabilitationDocs.{UPLOAD}.1",
		"businesssFormationDocumentsEntity1.1": "businessFormationDocs1.1.businesssFormationDocumentsEntity1.{UPLOAD}.1",
		"businesssFormationDocumentsEntity1.2": "businessFormationDocs1.2.businesssFormationDocumentsEntity1.{UPLOAD}.1",
		"businesssFormationDocumentsEntity1.3": "businessFormationDocs1.3.businesssFormationDocumentsEntity1.{UPLOAD}.1",
		"entityOwnerPersonEntity1.entityOwnerPerson1.name": "entityOwnerPersonEntity1.1.entityOwnerPerson.name",
		"entityOwnerPersonEntity1.entityOwnerPerson1.title": "entityOwnerPersonEntity1.1.entityOwnerPerson.title",
		"entityOwnerPersonEntity1.entityOwnerPerson1.dateOfBirth": "entityOwnerPersonEntity1.1.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity1.entityOwnerPerson1.email": "entityOwnerPersonEntity1.1.entityOwnerPerson.email",
		"entityOwnerPersonEntity1.entityOwnerPerson1.percentOwnership": "entityOwnerPersonEntity1.1.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity1.entityOwnerPerson2.name": "entityOwnerPersonEntity1.2.entityOwnerPerson.name",
		"entityOwnerPersonEntity1.entityOwnerPerson2.title": "entityOwnerPersonEntity1.2.entityOwnerPerson.title",
		"entityOwnerPersonEntity1.entityOwnerPerson2.dateOfBirth": "entityOwnerPersonEntity1.2.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity1.entityOwnerPerson2.email": "entityOwnerPersonEntity1.2.entityOwnerPerson.email",
		"entityOwnerPersonEntity1.entityOwnerPerson2.percentOwnership": "entityOwnerPersonEntity1.2.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity1.entityOwnerPerson3.name": "entityOwnerPersonEntity1.3.entityOwnerPerson.name",
		"entityOwnerPersonEntity1.entityOwnerPerson3.title": "entityOwnerPersonEntity1.3.entityOwnerPerson.title",
		"entityOwnerPersonEntity1.entityOwnerPerson3.dateOfBirth": "entityOwnerPersonEntity1.3.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity1.entityOwnerPerson3.email": "entityOwnerPersonEntity1.3.entityOwnerPerson.email",
		"entityOwnerPersonEntity1.entityOwnerPerson3.percentOwnership": "entityOwnerPersonEntity1.3.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity1.entityOwnerPerson4.name": "entityOwnerPersonEntity1.4.entityOwnerPerson.name",
		"entityOwnerPersonEntity1.entityOwnerPerson4.title": "entityOwnerPersonEntity1.4.entityOwnerPerson.title",
		"entityOwnerPersonEntity1.entityOwnerPerson4.dateOfBirth": "entityOwnerPersonEntity1.4.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity1.entityOwnerPerson4.email": "entityOwnerPersonEntity1.4.entityOwnerPerson.email",
		"entityOwnerPersonEntity1.entityOwnerPerson4.percentOwnership": "entityOwnerPersonEntity1.4.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity1.entityOwnerPerson5.name": "entityOwnerPersonEntity1.5.entityOwnerPerson.name",
		"entityOwnerPersonEntity1.entityOwnerPerson5.title": "entityOwnerPersonEntity1.5.entityOwnerPerson.title",
		"entityOwnerPersonEntity1.entityOwnerPerson5.dateOfBirth": "entityOwnerPersonEntity1.5.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity1.entityOwnerPerson5.email": "entityOwnerPersonEntity1.5.entityOwnerPerson.email",
		"entityOwnerPersonEntity1.entityOwnerPerson5.percentOwnership": "entityOwnerPersonEntity1.5.entityOwnerPerson.percentOwnership",
		"businesssFormationDocumentsEntity2.1": "businessFormationDocs2.1.businesssFormationDocumentsEntity2.{UPLOAD}.1",
		"businesssFormationDocumentsEntity2.2": "businessFormationDocs2.2.businesssFormationDocumentsEntity2.{UPLOAD}.1",
		"businesssFormationDocumentsEntity2.3": "businessFormationDocs2.3.businesssFormationDocumentsEntity2.{UPLOAD}.1",
		"entityOwnerPersonEntity2.entityOwnerPerson1.name": "entityOwnerPersonEntity2.1.entityOwnerPerson.name",
		"entityOwnerPersonEntity2.entityOwnerPerson1.title": "entityOwnerPersonEntity2.1.entityOwnerPerson.title",
		"entityOwnerPersonEntity2.entityOwnerPerson1.dateOfBirth": "entityOwnerPersonEntity2.1.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity2.entityOwnerPerson1.email": "entityOwnerPersonEntity2.1.entityOwnerPerson.email",
		"entityOwnerPersonEntity2.entityOwnerPerson1.percentOwnership": "entityOwnerPersonEntity2.1.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity2.entityOwnerPerson2.name": "entityOwnerPersonEntity2.2.entityOwnerPerson.name",
		"entityOwnerPersonEntity2.entityOwnerPerson2.title": "entityOwnerPersonEntity2.2.entityOwnerPerson.title",
		"entityOwnerPersonEntity2.entityOwnerPerson2.dateOfBirth": "entityOwnerPersonEntity2.2.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity2.entityOwnerPerson2.email": "entityOwnerPersonEntity2.2.entityOwnerPerson.email",
		"entityOwnerPersonEntity2.entityOwnerPerson2.percentOwnership": "entityOwnerPersonEntity2.2.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity2.entityOwnerPerson3.name": "entityOwnerPersonEntity2.3.entityOwnerPerson.name",
		"entityOwnerPersonEntity2.entityOwnerPerson3.title": "entityOwnerPersonEntity2.3.entityOwnerPerson.title",
		"entityOwnerPersonEntity2.entityOwnerPerson3.dateOfBirth": "entityOwnerPersonEntity2.3.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity2.entityOwnerPerson3.email": "entityOwnerPersonEntity2.3.entityOwnerPerson.email",
		"entityOwnerPersonEntity2.entityOwnerPerson3.percentOwnership": "entityOwnerPersonEntity2.3.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity2.entityOwnerPerson4.name": "entityOwnerPersonEntity2.4.entityOwnerPerson.name",
		"entityOwnerPersonEntity2.entityOwnerPerson4.title": "entityOwnerPersonEntity2.4.entityOwnerPerson.title",
		"entityOwnerPersonEntity2.entityOwnerPerson4.dateOfBirth": "entityOwnerPersonEntity2.4.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity2.entityOwnerPerson4.email": "entityOwnerPersonEntity2.4.entityOwnerPerson.email",
		"entityOwnerPersonEntity2.entityOwnerPerson4.percentOwnership": "entityOwnerPersonEntity2.4.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity2.entityOwnerPerson5.name": "entityOwnerPersonEntity2.5.entityOwnerPerson.name",
		"entityOwnerPersonEntity2.entityOwnerPerson5.title": "entityOwnerPersonEntity2.5.entityOwnerPerson.title",
		"entityOwnerPersonEntity2.entityOwnerPerson5.dateOfBirth": "entityOwnerPersonEntity2.5.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity2.entityOwnerPerson5.email": "entityOwnerPersonEntity2.5.entityOwnerPerson.email",
		"entityOwnerPersonEntity2.entityOwnerPerson5.percentOwnership": "entityOwnerPersonEntity2.5.entityOwnerPerson.percentOwnership",
		"businesssFormationDocumentsEntity3.1": "businessFormationDocs3.1.businesssFormationDocumentsEntity3.{UPLOAD}.1",
		"businesssFormationDocumentsEntity3.2": "businessFormationDocs3.2.businesssFormationDocumentsEntity3.{UPLOAD}.1",
		"businesssFormationDocumentsEntity3.3": "businessFormationDocs3.3.businesssFormationDocumentsEntity3.{UPLOAD}.1",
		"entityOwnerPersonEntity3.entityOwnerPerson1.name": "entityOwnerPersonEntity3.1.entityOwnerPerson.name",
		"entityOwnerPersonEntity3.entityOwnerPerson1.title": "entityOwnerPersonEntity3.1.entityOwnerPerson.title",
		"entityOwnerPersonEntity3.entityOwnerPerson1.dateOfBirth": "entityOwnerPersonEntity3.1.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity3.entityOwnerPerson1.email": "entityOwnerPersonEntity3.1.entityOwnerPerson.email",
		"entityOwnerPersonEntity3.entityOwnerPerson1.percentOwnership": "entityOwnerPersonEntity3.1.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity3.entityOwnerPerson2.name": "entityOwnerPersonEntity3.2.entityOwnerPerson.name",
		"entityOwnerPersonEntity3.entityOwnerPerson2.title": "entityOwnerPersonEntity3.2.entityOwnerPerson.title",
		"entityOwnerPersonEntity3.entityOwnerPerson2.dateOfBirth": "entityOwnerPersonEntity3.2.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity3.entityOwnerPerson2.email": "entityOwnerPersonEntity3.2.entityOwnerPerson.email",
		"entityOwnerPersonEntity3.entityOwnerPerson2.percentOwnership": "entityOwnerPersonEntity3.2.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity3.entityOwnerPerson3.name": "entityOwnerPersonEntity3.3.entityOwnerPerson.name",
		"entityOwnerPersonEntity3.entityOwnerPerson3.dateOfBirth": "entityOwnerPersonEntity3.3.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity3.entityOwnerPerson3.email": "entityOwnerPersonEntity3.3.entityOwnerPerson.email",
		"entityOwnerPersonEntity3.entityOwnerPerson3.percentOwnership": "entityOwnerPersonEntity3.3.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity3.entityOwnerPerson4.name": "entityOwnerPersonEntity3.4.entityOwnerPerson.name",
		"entityOwnerPersonEntity3.entityOwnerPerson4.title": "entityOwnerPersonEntity3.4.entityOwnerPerson.title",
		"entityOwnerPersonEntity3.entityOwnerPerson4.dateOfBirth": "entityOwnerPersonEntity3.4.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity3.entityOwnerPerson4.email": "entityOwnerPersonEntity3.4.entityOwnerPerson.email",
		"entityOwnerPersonEntity3.entityOwnerPerson4.percentOwnership": "entityOwnerPersonEntity3.4.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity3.entityOwnerPerson5.name": "entityOwnerPersonEntity3.5.entityOwnerPerson.name",
		"entityOwnerPersonEntity3.entityOwnerPerson5.title": "entityOwnerPersonEntity3.5.entityOwnerPerson.title",
		"entityOwnerPersonEntity3.entityOwnerPerson5.dateOfBirth": "entityOwnerPersonEntity3.5.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity3.entityOwnerPerson5.email": "entityOwnerPersonEntity3.5.entityOwnerPerson.email",
		"entityOwnerPersonEntity3.entityOwnerPerson5.percentOwnership": "entityOwnerPersonEntity3.5.entityOwnerPerson.percentOwnership",
		"businesssFormationDocumentsEntity4.1": "businessFormationDocs4.1.businesssFormationDocumentsEntity4.{UPLOAD}.1",
		"businesssFormationDocumentsEntity4.2": "businessFormationDocs4.2.businesssFormationDocumentsEntity4.{UPLOAD}.1",
		"businesssFormationDocumentsEntity4.3": "businessFormationDocs4.3.businesssFormationDocumentsEntity4.{UPLOAD}.1",
		"entityOwnerPersonEntity4.entityOwnerPerson1.name": "entityOwnerPersonEntity4.1.entityOwnerPerson.name",
		"entityOwnerPersonEntity4.entityOwnerPerson1.title": "entityOwnerPersonEntity4.1.entityOwnerPerson.title",
		"entityOwnerPersonEntity4.entityOwnerPerson1.dateOfBirth": "entityOwnerPersonEntity4.1.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity4.entityOwnerPerson1.email": "entityOwnerPersonEntity4.1.entityOwnerPerson.email",
		"entityOwnerPersonEntity4.entityOwnerPerson1.percentOwnership": "entityOwnerPersonEntity4.1.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity4.entityOwnerPerson2.name": "entityOwnerPersonEntity4.2.entityOwnerPerson.name",
		"entityOwnerPersonEntity4.entityOwnerPerson2.title": "entityOwnerPersonEntity4.2.entityOwnerPerson.title",
		"entityOwnerPersonEntity4.entityOwnerPerson2.dateOfBirth": "entityOwnerPersonEntity4.2.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity4.entityOwnerPerson2.email": "entityOwnerPersonEntity4.2.entityOwnerPerson.email",
		"entityOwnerPersonEntity4.entityOwnerPerson2.percentOwnership": "entityOwnerPersonEntity4.2.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity4.entityOwnerPerson3.name": "entityOwnerPersonEntity4.3.entityOwnerPerson.name",
		"entityOwnerPersonEntity4.entityOwnerPerson3.title": "entityOwnerPersonEntity4.3.entityOwnerPerson.title",
		"entityOwnerPersonEntity4.entityOwnerPerson3.dateOfBirth": "entityOwnerPersonEntity4.3.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity4.entityOwnerPerson3.email": "entityOwnerPersonEntity4.3.entityOwnerPerson.email",
		"entityOwnerPersonEntity4.entityOwnerPerson3.percentOwnership": "entityOwnerPersonEntity4.3.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity4.entityOwnerPerson4.name": "entityOwnerPersonEntity4.4.entityOwnerPerson.name",
		"entityOwnerPersonEntity4.entityOwnerPerson4.title": "entityOwnerPersonEntity4.4.entityOwnerPerson.title",
		"entityOwnerPersonEntity4.entityOwnerPerson4.dateOfBirth": "entityOwnerPersonEntity4.4.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity4.entityOwnerPerson4.email": "entityOwnerPersonEntity4.4.entityOwnerPerson.email",
		"entityOwnerPersonEntity4.entityOwnerPerson4.percentOwnership": "entityOwnerPersonEntity4.4.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity4.entityOwnerPerson5.name": "entityOwnerPersonEntity4.5.entityOwnerPerson.name",
		"entityOwnerPersonEntity4.entityOwnerPerson5.title": "entityOwnerPersonEntity4.5.entityOwnerPerson.title",
		"entityOwnerPersonEntity4.entityOwnerPerson5.dateOfBirth": "entityOwnerPersonEntity4.5.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity4.entityOwnerPerson5.email": "entityOwnerPersonEntity4.5.entityOwnerPerson.email",
		"entityOwnerPersonEntity4.entityOwnerPerson5.percentOwnership": "entityOwnerPersonEntity4.5.entityOwnerPerson.percentOwnership",
		"businesssFormationDocumentsEntity5.1": "businessFormationDocs5.1.businesssFormationDocumentsEntity5.{UPLOAD}.1",
		"businesssFormationDocumentsEntity5.2": "businessFormationDocs5.2.businesssFormationDocumentsEntity5.{UPLOAD}.1",
		"businesssFormationDocumentsEntity5.3": "businessFormationDocs5.3.businesssFormationDocumentsEntity5.{UPLOAD}.1",
		"entityOwnerPersonEntity5.entityOwnerPerson1.name": "entityOwnerPersonEntity5.1.entityOwnerPerson.name",
		"entityOwnerPersonEntity5.entityOwnerPerson1.title": "entityOwnerPersonEntity5.1.entityOwnerPerson.title",
		"entityOwnerPersonEntity5.entityOwnerPerson1.dateOfBirth": "entityOwnerPersonEntity5.1.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity5.entityOwnerPerson1.email": "entityOwnerPersonEntity5.1.entityOwnerPerson.email",
		"entityOwnerPersonEntity5.entityOwnerPerson1.percentOwnership": "entityOwnerPersonEntity5.1.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity5.entityOwnerPerson2.name": "entityOwnerPersonEntity5.2.entityOwnerPerson.name",
		"entityOwnerPersonEntity5.entityOwnerPerson2.title": "entityOwnerPersonEntity5.2.entityOwnerPerson.title",
		"entityOwnerPersonEntity5.entityOwnerPerson2.dateOfBirth": "entityOwnerPersonEntity5.2.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity5.entityOwnerPerson2.email": "entityOwnerPersonEntity5.2.entityOwnerPerson.email",
		"entityOwnerPersonEntity5.entityOwnerPerson2.percentOwnership": "entityOwnerPersonEntity5.2.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity5.entityOwnerPerson3.name": "entityOwnerPersonEntity5.3.entityOwnerPerson.name",
		"entityOwnerPersonEntity5.entityOwnerPerson3.title": "entityOwnerPersonEntity5.3.entityOwnerPerson.title",
		"entityOwnerPersonEntity5.entityOwnerPerson3.dateOfBirth": "entityOwnerPersonEntity5.3.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity5.entityOwnerPerson3.email": "entityOwnerPersonEntity5.3.entityOwnerPerson.email",
		"entityOwnerPersonEntity5.entityOwnerPerson3.percentOwnership": "entityOwnerPersonEntity5.3.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity5.entityOwnerPerson4.name": "entityOwnerPersonEntity5.4.entityOwnerPerson.name",
		"entityOwnerPersonEntity5.entityOwnerPerson4.title": "entityOwnerPersonEntity5.4.entityOwnerPerson.title",
		"entityOwnerPersonEntity5.entityOwnerPerson4.dateOfBirth": "entityOwnerPersonEntity5.4.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity5.entityOwnerPerson4.email": "entityOwnerPersonEntity5.4.entityOwnerPerson.email",
		"entityOwnerPersonEntity5.entityOwnerPerson4.percentOwnership": "entityOwnerPersonEntity5.4.entityOwnerPerson.percentOwnership",
		"entityOwnerPersonEntity5.entityOwnerPerson5.name": "entityOwnerPersonEntity5.5.entityOwnerPerson.name",
		"entityOwnerPersonEntity5.entityOwnerPerson5.title": "entityOwnerPersonEntity5.5.entityOwnerPerson.title",
		"entityOwnerPersonEntity5.entityOwnerPerson5.dateOfBirth": "entityOwnerPersonEntity5.5.entityOwnerPerson.dateOfBirth",
		"entityOwnerPersonEntity5.entityOwnerPerson5.email": "entityOwnerPersonEntity5.5.entityOwnerPerson.email",
		"entityOwnerPersonEntity5.entityOwnerPerson5.percentOwnership": "entityOwnerPersonEntity5.5.entityOwnerPerson.percentOwnership",
		"investors.investor1.name": "investors.1.investor.name",
		"investors.investor1.investorType": "investors.1.investor.investorType",
		"investors.investor1.percentOwnership": "investors.1.investor.percentOwnership",
		"investors.investor1.whatIsTheInterestOrInvestment": "investors.1.investor.whatIsTheInterestOrInvestment",
		"investors.investor2.name": "investors.2.investor.name",
		"investors.investor2.investorType": "investors.2.investor.investorType",
		"investors.investor2.percentOwnership": "investors.2.investor.percentOwnership",
		"investors.investor2.whatIsTheInterestOrInvestment": "investors.2.investor.whatIsTheInterestOrInvestment",
		"investors.investor3.name": "investors.3.investor.name",
		"investors.investor3.investorType": "investors.3.investor.investorType",
		"investors.investor3.percentOwnership": "investors.3.investor.percentOwnership",
		"investors.investor3.whatIsTheInterestOrInvestment": "investors.3.investor.whatIsTheInterestOrInvestment",
		"investors.investor4.name": "investors.4.investor.name",
		"investors.investor4.investorType": "investors.4.investor.investorType",
		"investors.investor4.percentOwnership": "investors.4.investor.percentOwnership",
		"investors.investor4.whatIsTheInterestOrInvestment": "investors.4.investor.whatIsTheInterestOrInvestment",
		"investors.investor5.name": "investors.5.investor.name",
		"investors.investor5.investorType": "investors.5.investor.investorType",
		"investors.investor5.percentOwnership": "investors.5.investor.percentOwnership",
		"investors.investor5.whatIsTheInterestOrInvestment": "investors.5.investor.whatIsTheInterestOrInvestment",
		"uploadYourNeighborhoodNotice1": "neighborhoodNotice.1.uploadYourNeighborhoodNotice.{UPLOAD}.1",
		"uploadYourNeighborhoodNotice2": "neighborhoodNotice.2.uploadYourNeighborhoodNotice.{UPLOAD}.1",
		"uploadYourNeighborhoodNotice3": "neighborhoodNotice.3.uploadYourNeighborhoodNotice.{UPLOAD}.1",
		"uploadYourNeighborhoodNotice4": "neighborhoodNotice.4.uploadYourNeighborhoodNotice.{UPLOAD}.1",
		"uploadSignInSheetsFromNeighborhoodMeetings": "uploadSignInSheetsFromNeighborhoodMeetings.{UPLOAD}.1",
		"uploadMinutesFromNeighborhoodMeetings": "uploadMinutesFromNeighborhoodMeetings.{UPLOAD}.1",
		"uploadMeetingMaterials1": "meetingMaterials.1.uploadMeetingMaterials.{UPLOAD}.1",
		"uploadMeetingMaterials2": "meetingMaterials.2.uploadMeetingMaterials.{UPLOAD}.1",
		"uploadWrittenInputFromNeighbors": "uploadWrittenInputFromNeighbors.{UPLOAD}.1",
		"uploadListOfNeighborsSentNoticeTo": "uploadListOfNeighborsSentNoticeTo.{UPLOAD}.1",
		"uploadFinalExecutedGoodNeighborPolicy": "uploadFinalExecutedGoodNeighborPolicy.{UPLOAD}.1",
		"hadCompassionProgramBeforeJanTwoZeroOneEight": "hadCompassionProgramBeforeJan2018",
		"uploadOrganizationalChart": "uploadOrganizationalChart.{UPLOAD}.1",
		"uploadStaffingAndLaborForm": "uploadStaffingAndLaborForm.{UPLOAD}.1",
		"uploadSignedFirstSourceHiringAgreement": "uploadSignedFirstSourceHiringAgreement.{UPLOAD}.1",
		"stateDocument": "stateDocument.{UPLOAD}.1",
		"cityDocument": "cityDocument.{UPLOAD}.1",
		"uploadAdditionalDocuments1": "cityDocumentUpload.1.uploadAdditionalDocuments.{UPLOAD}.1",
		"uploadAdditionalDocuments2": "cityDocumentUpload.2.uploadAdditionalDocuments.{UPLOAD}.1",
		"uploadAdditionalDocuments3": "cityDocumentUpload.3.uploadAdditionalDocuments.{UPLOAD}.1",
		"securityEmployees1.fullName": "securityEmployees.1.fullName",
		"securityEmployees1.jobTitle": "securityEmployees.1.jobTitle",
		"securityEmployees1.responsibility": "securityEmployees.1.responsibility",
		"securityEmployees1.phoneNumber": "securityEmployees.1.phoneNumber",
		"securityEmployees1.email": "securityEmployees.1.email",
		"securityEmployees2.fullName": "securityEmployees.2.fullName",
		"securityEmployees2.jobTitle": "securityEmployees.2.jobTitle",
		"securityEmployees2.responsibility": "securityEmployees.2.responsibility",
		"securityEmployees2.phoneNumber": "securityEmployees.2.phoneNumber",
		"securityEmployees2.email": "securityEmployees.2.email",
		"securityEmployees3.fullName": "securityEmployees.3.fullName",
		"securityEmployees3.jobTitle": "securityEmployees.3.jobTitle",
		"securityEmployees3.responsibility": "securityEmployees.3.responsibility",
		"securityEmployees3.phoneNumber": "securityEmployees.3.phoneNumber",
		"securityEmployees3.email": "securityEmployees.3.email",
		"securityEmployees4.fullName": "securityEmployees.4.fullName",
		"securityEmployees4.jobTitle": "securityEmployees.4.jobTitle",
		"securityEmployees4.responsibility": "securityEmployees.4.responsibility",
		"securityEmployees4.phoneNumber": "securityEmployees.4.phoneNumber",
		"securityEmployees4.email": "securityEmployees.4.email",
		"securityEmployees5.fullName": "securityEmployees.5.fullName",
		"securityEmployees5.jobTitle": "securityEmployees.5.jobTitle",
		"securityEmployees5.responsibility": "securityEmployees.5.responsibility",
		"securityEmployees5.phoneNumber": "securityEmployees.5.phoneNumber",
		"securityEmployees5.email": "securityEmployees.5.email",
		"uploadEmployeeBadgeTemplate": "uploadEmployeeBadgeTemplate.{UPLOAD}.1",
		"uploadContractorVendorSignInTemplate": "uploadContractorVendorSignInTemplate.{UPLOAD}.1",
		"transportSecurityContractCopyUpload": "transportSecurityContractCopyUpload.{UPLOAD}.1",
		"listYourSecurityPersonnelByName1.securityPersonnelListByName": "listYourSecurityPersonnelByName.1.securityPersonnelListByName",
		"listYourSecurityPersonnelByName1.licenseNumber": "listYourSecurityPersonnelByName.1.licenseNumber",
		"listYourSecurityPersonnelByName1.securityRole": "listYourSecurityPersonnelByName.1.securityRole",
		"listYourSecurityPersonnelByName1.willThisSecurityMemberCarryFirearms": "listYourSecurityPersonnelByName.1.willThisSecurityMemberCarryFirearms",
		"listYourSecurityPersonnelByName2.securityPersonnelListByName": "listYourSecurityPersonnelByName.2.securityPersonnelListByName",
		"listYourSecurityPersonnelByName2.licenseNumber": "listYourSecurityPersonnelByName.2.licenseNumber",
		"listYourSecurityPersonnelByName2.securityRole": "listYourSecurityPersonnelByName.2.securityRole",
		"listYourSecurityPersonnelByName2.willThisSecurityMemberCarryFirearms": "listYourSecurityPersonnelByName.2.willThisSecurityMemberCarryFirearms",
		"listYourSecurityPersonnelByName3.securityPersonnelListByName": "listYourSecurityPersonnelByName.3.securityPersonnelListByName",
		"listYourSecurityPersonnelByName3.licenseNumber": "listYourSecurityPersonnelByName.3.licenseNumber",
		"listYourSecurityPersonnelByName3.securityRole": "listYourSecurityPersonnelByName.3.securityRole",
		"listYourSecurityPersonnelByName3.willThisSecurityMemberCarryFirearms": "listYourSecurityPersonnelByName.3.willThisSecurityMemberCarryFirearms",
		"securityContractCopyUpload": "securityContractCopyUpload.{UPLOAD}.1",
		"premisesDiagramUpload": "premisesDiagramUpload.{UPLOAD}.1",
		"contractWithTransportSecurityCompany": "contractWithTransportSecurityCompany.{UPLOAD}.1",
		"fertilizersDataGrid.chemicalNameOfFertilizer1": "fertilizersDataGrid.1.chemicalNameOfFertilizer",
		"fertilizersDataGrid.chemicalNameOfFertilizer2": "fertilizersDataGrid.2.chemicalNameOfFertilizer",
		"fertilizersDataGrid.chemicalNameOfFertilizer3": "fertilizersDataGrid.3.chemicalNameOfFertilizer",
		"fertilizersDataGrid.chemicalNameOfFertilizer4": "fertilizersDataGrid.4.chemicalNameOfFertilizer",
		"fertilizersDataGrid.chemicalNameOfFertilizer5": "fertilizersDataGrid.5.chemicalNameOfFertilizer",
		"fertilizersDataGrid.chemicalNameOfFertilizer6": "fertilizersDataGrid.6.chemicalNameOfFertilizer",
		"fertilizersDataGrid.chemicalNameOfFertilizer7": "fertilizersDataGrid.7.chemicalNameOfFertilizer",
		"fertilizersDataGrid.chemicalNameOfFertilizer8": "fertilizersDataGrid.8.chemicalNameOfFertilizer",
		"fertilizersDataGrid.chemicalNameOfFertilizer9": "fertilizersDataGrid.9.chemicalNameOfFertilizer",
		"fertilizersDataGrid.chemicalNameOfFertilizer10": "fertilizersDataGrid.10.chemicalNameOfFertilizer",
		"deliveryVehicleInformation.vehicleIdentificationNumber1": "deliveryVehicleInformation.1.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance1": "deliveryVehicleInformation.1.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"deliveryVehicleInformation.vehicleIdentificationNumber2": "deliveryVehicleInformation.2.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance2": "deliveryVehicleInformation.2.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"deliveryVehicleInformation.vehicleIdentificationNumber3": "deliveryVehicleInformation.3.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance3": "deliveryVehicleInformation.3.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"deliveryVehicleInformation.vehicleIdentificationNumber4": "deliveryVehicleInformation.4.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance4": "deliveryVehicleInformation.4.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"deliveryVehicleInformation.vehicleIdentificationNumber5": "deliveryVehicleInformation.5.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance5": "deliveryVehicleInformation.5.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"deliveryVehicleInformation.vehicleIdentificationNumber6": "deliveryVehicleInformation.6.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance6": "deliveryVehicleInformation.6.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"deliveryVehicleInformation.vehicleIdentificationNumber7": "deliveryVehicleInformation.7.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance7": "deliveryVehicleInformation.7.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"deliveryVehicleInformation.vehicleIdentificationNumber8": "deliveryVehicleInformation.8.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance8": "deliveryVehicleInformation.8.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"deliveryVehicleInformation.vehicleIdentificationNumber9": "deliveryVehicleInformation.9.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance9": "deliveryVehicleInformation.9.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"deliveryVehicleInformation.vehicleIdentificationNumber10": "deliveryVehicleInformation.10.vehicleIdentificationNumber",
		"deliveryVehicleInformation.uploadProofOfAutomobileInsurance10": "deliveryVehicleInformation.10.uploadProofOfAutomobileInsurance.{UPLOAD}.1",
		"uploadPackagingDiagram": "uploadPackagingDiagram.{UPLOAD}.1",
		"uploadProofOfAccreditationOrApplication": "uploadProofOfAccreditationOrApplication.{UPLOAD}.1"
	};

	return mappings;
}
