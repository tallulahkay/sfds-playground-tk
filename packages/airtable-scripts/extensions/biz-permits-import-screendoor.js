{

	// "import" these utilities from the functions at the end of this script
const { GroupedArray, DefaultMap, getCellObject, getFieldsByName, getRecordObjects, loopChunks, confirm, clearTable, parseDate, by, chain } = utils();
const { getProjectStatusFields } = status();
const { values, entries, fromEntries } = Object;

const Basename = "Cannabis Business Permit";
const ScreendoorTableName = "SCREENDOOR_BUSINESS_PERMIT";
const ScreendoorRevTableName = ScreendoorTableName + "_REV";
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
};
const InitialID = "Initial Screendoor Response ID";
const ReviewsTableName = Basename + " Reviews";
const ReviewFields = {
	MostRecent: "Initial Application - Latest Submission",
	Previous: "Initial Application - Previous Submissions",
	SubmissionID: "Initial Application Submission ID",
	InitialID: "Initial Response ID",
	ResponseNum: "Initial Application Screendoor Number",
	OriginalDate: "Project Submission Date",
	Status: "Project Status",
};
const BOBizOwnerList = "wj1tb99y";
const BONameFields = {
	First: "ftx0x558",
	Last: "4m3npp4g",
	AirtableField: "bizOwnerName",
};
const BOBizEntityList = "yse4clw9";
const BOBizEntityFields = {
  "qrtvzu67": "businessNameEntity#",
  "hy38kmwp": "tradeNameEntity#",
  "y7g3u3qe": "businessAddressEntity#.",
  "30oj0r4t": "dateOfIncorporationEntity#",
  "2egh7w2w": "percentageOfOwnershipEntity#",
  "n9d6m859": "ownershipStructureDetailsEntity#",
  "vcz5ggkc": "businessFormationDocs#.1.businesssFormationDocumentsEntity#.{UPLOAD}.1"
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
	["8110", "Renewal", "ren", "Ren1"],
	["9026", "Renewal", "ren", "Ren2"],
	["9436", "Renewal", "ren", "Ren3"]
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
const MetadataTableFields = [
	{
		name: "Activity Date",
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
		type: "string",
		options: {
			precision: 0
		},
	},
	{
		name: "Permit Reviews Metadata",
		key: "",
		type: "multipleRecordLinks",
		options: {
				// we'll set this below after the user chooses a reviews table
			linkedTableId: null
		}
	},
];
const StringFieldTypes = [
	"singleLineText",
	"multilineText",
	"richText",
	"email",
	"phoneNumber",
	"url",
];
const ActivityTableName = "Activity History";
//const ApprovalPattern = /(approved .+ edits|submitted edits for review\.)/;
//const ApprovalPattern = /(approved .+ edits|edited the response\.|submitted edits for review\.)/;
const ApprovalPattern = /(approved .+ edits|edited the response\.)/;
// TODO: also match `changed the status to **Submitted**`?

const submissionsTablesByFormID = fromEntries(Forms.info("biz")
	.map(({ id, name }) => [id, base.getTable(name + " Submissions")]));
const context = {
  submissionsTablesByFormID,
  submissionsTableMetadataByFormID: fromEntries(entries(submissionsTablesByFormID)
		.map(([formID, table]) => [formID, getFieldsByName(table)])),
  submissionsTables: [...new Set(values(submissionsTablesByFormID))],
  reviewsTable: base.getTable(ReviewsTableName),
  metadataTable: base.getTable(MetadataTableName)
};
const startTime = Date.now();

await output.markdown(`Starting at **${new Date().toLocaleString()}**`);

const result = await chain(
	context,
	[
		createApprovalMetadataFromJSONFile,
//		clearExistingRecords,
		convertScreendoorDataToAirtableData,
		console.log,
//		groupSubmissionsByFormAndInitialID,
//		createSubmissions,
		updateSubmissionsWithMissingMetadata,
//		console.log,
//		createReviewData,
//		console.log,
//		createReviewRecords,
//		updateSubmissionsWithProjectID,
//		console.log,
//		fillInReviewRecordsByInitialID,
//		console.log,
//		createMetadataRecords,
//		connectMetadataRecords,
	]
);

console.log(result);

await output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s** at **${new Date().toLocaleString()}**`);

// ====================================================================================================================
// import metadata from JSON file
// ====================================================================================================================

async function createApprovalMetadataFromJSONFile(
	context)
{
	const jsonFile = await input.fileAsync(
		"Choose a .json file containing Screendoor metadata:",
		{
			allowedFileTypes: [".json", "application/json"],
		}
	);

		// sort metadata newest to oldest, which is how we want the events to appear in the interface
	const metadataItems = jsonFile.parsedContents.sort(by("timestamp", true));
	const approvalMetadataByInitialIDByFormID = new DefaultMap(GroupedArray);

	for (const item of metadataItems) {
		const { responseID, initialID, formID, event } = item;

		if (ApprovalPattern.test(event)) {
			approvalMetadataByInitialIDByFormID.get(formID).push(initialID ?? responseID, item);
		}
	}

	return {
		...context,
		metadataItems,
		approvalMetadataByInitialIDByFormID,
	};
}

// ====================================================================================================================
// clear existing records in all tables
// ====================================================================================================================

async function clearExistingRecords(
	context)
{
	const { submissionsTables, reviewsTable, metadataTable } = context;

	if (!await confirm("Clear the submissions, reviews, and metadata tables?")) {
			// return true to stop the chain
		return true;
	}

// TODO: don't delete records that have RESPONSE_NUM >= 10000, which are test records
//  add a filter param to clearTable
		// clear all of the submission tables
	await Promise.all(submissionsTables.map((table) => clearTable(table)));
	await clearTable(reviewsTable);
	await clearTable(metadataTable);
	await clearTable(base.getTable(ActivityTableName));
}

// ====================================================================================================================
// convert AIRTABLE_JSON fields to Airtable record data
// ====================================================================================================================

async function convertScreendoorDataToAirtableData(
	context)
{
	const { submissionsTableMetadataByFormID } = context;
	const screendoorTable = base.getTable(ScreendoorTableName);
	const screendoorRevTable = base.getTable(ScreendoorRevTableName);
	const airtableDataByInitialIDByFormID = new DefaultMap(GroupedArray);
	const iaStatusInfoByInitialID = {};
	const fieldNameMappings = getNameMappings();
	const allowedFormIDs = Forms.info("biz").map(({ id }) => id);

	const replaceIndex = (value, i) => value.replaceAll("#", i + 1);

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

	(await getRecordObjects(screendoorRevTable, ScreendoorFields))
			// confusingly, we have to sort the revisions by the SUBMITTED_AT field in the REV table *before* adding in the
			// unsorted submission records.  this is because the submissions will have a SUBMITTED_AT date from the original
			// submission time, even though the most recent submission time is more recent (if there are revisions), and we'll
			// need to get that most recent time from the metadata.  at this point, we don't have a reliable timestamp that
			// will guarantee the most recent submission will come last if we sort by it, so that's why we just append the
			// submissions after the sorted revisions.
		.sort(by("SUBMITTED_AT"))
		.concat(await getRecordObjects(screendoorTable, ScreendoorFields))
		// make sure we're not including rogue 9396 forms, as well as all the revisions with null JSON
		.filter(({ AIRTABLE_JSON, SCREENDOOR_FORM_ID }) => AIRTABLE_JSON && allowedFormIDs.includes(SCREENDOOR_FORM_ID))
//.filter(({ RESPONSE_ID }) => RESPONSE_ID > 3840000)
//.filter(({ RESPONSE_ID }) => RESPONSE_ID < 2183940)
		.forEach(({
			RESPONSE_ID,
			RESPONSE_NUM,
			INITIAL_RESPONSE_ID,
			ARCHIVED_ID,
			RESPONSE_JSON,
			AIRTABLE_JSON,
			AIRTABLE_JSON_BO,
			SCREENDOOR_FORM_ID: formID
		}) => {
			const initialID = INITIAL_RESPONSE_ID ?? RESPONSE_ID;
			const tableMetadata = submissionsTableMetadataByFormID[formID];
			const overrides = {
					// this key is in the Airtable JSON, but for the revisions, it's not the ID of the original submission; it's some
					// other, unrelated ID.  but we need the original response ID to link the revisions to the originals.  so overwrite
					// the RESPONSE_ID field in the Airtable data with the one from Screendoor.  the revisions also won't have the
					// sequential_id in the JSON, so take it from the RESPONSE_NUM field in the record and make sure it's a string,
					// since that's what submission tables expect.
				RESPONSE_ID: initialID,
				RESPONSE_NUM: String(RESPONSE_NUM),
					// we want to give current submissions a blank SUBMISSION_ID, but a 0 to revisions.  this makes it possible
					// to distinguish them when generating Form.io records.  ARCHIVED_ID is only set on revisions.
				SUBMISSION_ID: ARCHIVED_ID ? "0" : "",
			};

			airtableDataByInitialIDByFormID.get(formID).push(initialID,
				getDataFromJSON(AIRTABLE_JSON, tableMetadata, overrides));

			if (formID === Forms.IA.id) {
					// 5804 records return the Initial Application data in the AIRTABLE_JSON field and have another JSON field
					// for the data that was separated out into the Business Ownership form
				const boFormID = Forms.BO.id;
				const tableMetadata = submissionsTableMetadataByFormID[boFormID];
					// we need to pull some data from the Screendoor JSON for the IA and BO submissions
				const {
					status,
					labels,
					responses: {
						[BOBizOwnerList]: bizOwners,
						[BOBizEntityList]: entities,
					}
				} = JSON.parse(RESPONSE_JSON);

					// the last submission to store its status and labels here should be the most recent submission, since we
					// sorted the revisions before the submissions above
				iaStatusInfoByInitialID[initialID] = [status, labels];

				if (Array.isArray(bizOwners)) {
						// the Form.io form can only show up to 5 business owners, so limit the count
					overrides.bizOwnerNumber = Math.min(bizOwners.length, 5);

					bizOwners.slice(0, 5).forEach((owner, i) => {
						const {
							[BONameFields.First]: first,
							[BONameFields.Last]: last,
						} = owner;

						overrides[BONameFields.AirtableField + (i + 1)] = `${first} ${last}`;
					});
				}

				if (Array.isArray(entities)) {
					entities.slice(0, 5).forEach((entity, entityIndex) => {
						entries(BOBizEntityFields).forEach(([sdName, atName]) => {
							const value = entity[sdName];
							const atNameIndexed = replaceIndex(atName, entityIndex);

							if (value) {
								if (atNameIndexed.includes("Docs")) {
									if (value.length > 3) {
										console.error("Skipping some upload docs", RESPONSE_JSON);
									}

									value.slice(0, 3).forEach((upload, uploadIndex) => {
										overrides[atNameIndexed.replace(".1.", `.${uploadIndex + 1}.`)] = upload.filename;
									});
								} else if (atNameIndexed.includes("Address")) {
										// this is the address object
									const { country, zipcode, street, ...address } = value;

										// rename zipcode and street keys
									entries({ zip: zipcode, line1: street, ...address }).forEach(([key, addrValue]) => {
										if (addrValue) {
											overrides[atNameIndexed + key] = addrValue;
										}
									});
								} else if (atNameIndexed.includes("date")) {
									const { year, month, day } = value;

										// make sure this isn't an empty object
									if ([year, month, day].every(Number.isFinite)) {
										overrides[atNameIndexed] = new Date(`${year}-${month}-${day}`).toISOString();
									}
								} else if (atNameIndexed.includes("percentage")) {
									overrides[atNameIndexed] = parseFloat(value);
								} else {
									overrides[atNameIndexed] = value;
								}
							}
						});
					});
				}

				airtableDataByInitialIDByFormID.get(boFormID).push(initialID,
					getDataFromJSON(AIRTABLE_JSON_BO, tableMetadata, overrides));
			}
		});

	return {
		...context,
		iaStatusInfoByInitialID,
		airtableDataByInitialIDByFormID,
	};
}

// ====================================================================================================================
// group submissions by form
// ====================================================================================================================

async function groupSubmissionsByFormAndInitialID(
	context)
{
	const { submissionsTables } = context;
	const { ID, ProjectID } = SubmissionFields;
	const submissionRecordIDsByResponseByFormID = {};

	for (const table of submissionsTables) {
			// the IA table doesn't currently have the InitialID field, so start with the other fields and then add InitialID
			// if it's in the table, since Airtable throws if you try to get a field that doesn't exist.  ffs.
		const fields = [ID, ProjectID]
			.concat(table.fields.some(({ name }) => name === InitialID) ? InitialID : []);
		const records = (await getRecordObjects(table, fields))
			.filter(({ RESPONSE_ID }) => RESPONSE_ID);
		const formName = table.name.replace(" Submissions", "");
		const recordIDsByResponse = new GroupedArray();

		records.forEach((record) => {
			recordIDsByResponse.push(record[InitialID] || record[ID], { id: record._id });
		});
		submissionRecordIDsByResponseByFormID[Forms[formName].id] = recordIDsByResponse;
	}

	context.submissionRecordIDsByResponseByFormID = submissionRecordIDsByResponseByFormID;
}

// ====================================================================================================================
// create Initial Application submissions
// ====================================================================================================================

async function createSubmissions(
	context)
{
	const {
		airtableDataByInitialIDByFormID,
		approvalMetadataByInitialIDByFormID,
	} = context;
	const submissionRecordIDsByResponseByFormID = {};

	for (const [formID, airtableDataByInitialID] of airtableDataByInitialIDByFormID.entries()) {
			// the IA and BO forms share the same metadata, but it's been stored under 5804.  so use that form ID to look up
			// the metadata in the special BO case.
		const metadataFormID = formID === Forms.BO.id ? Forms.IA.id : formID;
		const approvalMetadataByInitialID = approvalMetadataByInitialIDByFormID.get(metadataFormID);
		const submissions = [];
// TODO: solve The Case of the Missing Metadata
const missingMetadata = [];
console.log("form", formID, "approvalMetadataByInitialID", approvalMetadataByInitialID);

		airtableDataByInitialID.forEach((initialID, items) => {
				// submissions in this array were pushed on to it from oldest to newest, so firstSubmission is the oldest
			const [firstSubmission, ...rest] = items;

			submissions.push({ fields: firstSubmission });

			if (rest.length) {
				if (!approvalMetadataByInitialID.has(initialID)) {
// TODO: in this case we could set the submitted date of the item at the end of the rest array,
//  which should be the current submission, to the previous item and add 60s?
// rest.at(-1).Submitted
//				console.log(`No approval metadata for response ${initialID} in form ${formID}.`, firstSubmission, rest);
missingMetadata.push([formID, initialID, firstSubmission, rest]);
//return;
//				throw new Error(`No metadata for response ${initialID} in form ${formID}.`);
				} else {
						// the metadata was sorted newest to oldest when it was imported above, so the newest date is the first
					const newestSubmittedDate = approvalMetadataByInitialID.get(initialID)[0];

						// when there are revisions, the submission date of the "current" submission is not included in the JSON, so we
						// have to pull it from the metadata.  the most recent metadata date is when the current submission was approved.
					rest.at(-1).Submitted = newestSubmittedDate.timestamp;
				}

					// store each of the submissions on a fields key so it's ready to be used to create a new record
				submissions.push(...(rest.map((fields) => ({ fields }))));
			}
		});

			// we now need to sort the submissions in descending order so that the first record in each GroupedArray value will
			// be the most recent submission when we store it in the loopChunks() below.  that way, it'll be the latestID that we
			// use to get the latest submission when creating the review record in the for loop below.  we have to dig into the
			// fields to get the date, and then call parseDate(), because the format isn't quite parseable with new Date().
		submissions.sort(by(({ fields: { Submitted } }) => Submitted, true));

		const recordIDsByResponse = new GroupedArray();
		const submissionsTable = submissionsTablesByFormID[formID];

		await output.markdown(`Starting import of **${submissions.length}** submissions for **${Forms[formID].name}**...`);

missingMetadata.length && console.error(`missingMetadata: ${missingMetadata.length}, total: ${airtableDataByInitialID.keys().length}`, missingMetadata);

console.log(formID, submissions);

		await loopChunks(submissions, async (chunk) => {
			const records = await submissionsTable.createRecordsAsync(chunk);

			chunk.forEach((submission, i) => {
				const { fields: { [SubmissionFields.ID]: responseID } } = submission;

				recordIDsByResponse.push(responseID, { id: records[i] });
			});
		});

		submissionRecordIDsByResponseByFormID[formID] = recordIDsByResponse;
	}

	context.submissionRecordIDsByResponseByFormID = submissionRecordIDsByResponseByFormID;
}

// ====================================================================================================================
// update submissions with missing metadata
// ====================================================================================================================

async function updateSubmissionsWithMissingMetadata(
	context)
{
	const {
		airtableDataByInitialIDByFormID,
		approvalMetadataByInitialIDByFormID,
	} = context;
	const submissionRecordIDsByResponseByFormID = {};

	for (const [formID, airtableDataByInitialID] of airtableDataByInitialIDByFormID.entries()) {
			// the IA and BO forms share the same metadata, but it's been stored under 5804.  so use that form ID to look up
			// the metadata in the special BO case.
		const metadataFormID = formID === Forms.BO.id ? Forms.IA.id : formID;
		const approvalMetadataByInitialID = approvalMetadataByInitialIDByFormID.get(metadataFormID);
		const submissions = [];
const missingMetadata = [];
let missingMetadataCount = 0;
console.log("form", formID, "approvalMetadataByInitialID", approvalMetadataByInitialID);

		airtableDataByInitialID.forEach((initialID, items) => {
			if (approvalMetadataByInitialID.has(initialID) || items.length === 1) {
				return;
			}

missingMetadataCount++;
// TODO: in this case we could set the submitted date of the item at the end of the rest array,
//  which should be the current submission, to the previous item and add 60s?

			const newestSubmittedDate = new Date(new Date(items.at(-2).Submitted) + (60 * 1000)).toISOString();
//				const newestSubmittedDate = rest.at(-2).Submitted;

			items.at(-1).Submitted = newestSubmittedDate;

			submissions.push(...items.map((fields) => ({ fields })));
		});

//		submissions.sort(by(({ fields: { Submitted } }) => Submitted, true));

console.log("missingMetadataCount", missingMetadataCount);
//console.log(formID, submissions);

		await output.inspect(submissions);

		await output.table(submissions.map(({ fields: { RESPONSE_ID, RESPONSE_NUM, Submitted } }) => ({
			RESPONSE_ID,
			RESPONSE_NUM,
			Submitted
		})));

/*
		const recordIDsByResponse = new GroupedArray();
		const submissionsTable = submissionsTablesByFormID[formID];

		await output.markdown(`Starting import of **${submissions.length}** submissions for **${Forms[formID].name}**...`);

missingMetadata.length && console.error(`missingMetadata: ${missingMetadata.length}, total: ${airtableDataByInitialID.keys().length}`, missingMetadata);

		await loopChunks(submissions, async (chunk) => {
			const records = await submissionsTable.createRecordsAsync(chunk);

			chunk.forEach((submission, i) => {
				const { fields: { [SubmissionFields.ID]: responseID } } = submission;

				recordIDsByResponse.push(responseID, { id: records[i] });
			});
		});

		submissionRecordIDsByResponseByFormID[formID] = recordIDsByResponse;
*/
	}

	context.submissionRecordIDsByResponseByFormID = submissionRecordIDsByResponseByFormID;
}

// ====================================================================================================================
// create reviews from Initial Application submissions
// ====================================================================================================================

async function createReviewData(
	context)
{
	const { submissionRecordIDsByResponseByFormID, iaStatusInfoByInitialID } = context;
	const iaRecordIDs = submissionRecordIDsByResponseByFormID[Forms.IA.id].values();
	const reviews = [];

	await output.markdown(`Constructing ${iaRecordIDs.length} reviews...`);

	function normalizeLink(
		record)
	{
		// linked records need to be wrapped in an array, unless the list is empty/null
		if (Array.isArray(record)) {
			return record.length ? record : null;
		} else {
			return record ? [record] : null;
		}
	}

		// create a review for each of the Initial Application submissions
	for (const [latestRecordID, ...previousRecordIDs] of iaRecordIDs) {
		const submissionsTable = submissionsTablesByFormID[Forms.IA.id];
			// get the created record for the most recent submission, so we can get any fields set by formulas
			// that we need to use when generating the review data below
		const latestRecord = await submissionsTable.selectRecordAsync(latestRecordID.id);
		const latest = getCellObject(latestRecord, values(SubmissionFields));
		const responseID = latest[SubmissionFields.ID];
			// link to all of the part 2 submissions related to this review
		const linkFields = Forms.info("part2")
			.reduce((result, { name, id }) => {
					// if we got no submissions at all for a form, this could be undefined
				const [latest, ...previous] = submissionRecordIDsByResponseByFormID[id]?.get(responseID) || [];

				result[`${name} - Latest Submission`] = normalizeLink(latest);
				result[`${name} - Previous Submissions`] = normalizeLink(previous);

				return result;
			}, {});
		const statusFields = getProjectStatusFields(...iaStatusInfoByInitialID[responseID]);
		let originalSubmittedDate = latest[SubmissionFields.Submitted];

		if (previousRecordIDs.length) {
				// with more than one record, the original submission date is from the oldest record, which is last in this array
			const oldestRecord = await submissionsTable.selectRecordAsync(previousRecordIDs.at(-1).id);
			const oldest = getCellObject(oldestRecord, values(SubmissionFields));

			originalSubmittedDate = oldest[SubmissionFields.Submitted];
		}

		reviews.push({
			fields: {
				[ReviewFields.SubmissionID]: latest[SubmissionFields.SubmissionID],
				[ReviewFields.InitialID]: responseID,
				[ReviewFields.ResponseNum]: latest[SubmissionFields.Num],
				[ReviewFields.OriginalDate]: parseDate(originalSubmittedDate).toISOString(),
				[ReviewFields.MostRecent]: normalizeLink(latestRecordID),
				[ReviewFields.Previous]: normalizeLink(previousRecordIDs),
				...linkFields,
				...statusFields,
			}
		});
	}

	context.reviews = reviews;
}

// ====================================================================================================================
// create review records
// ====================================================================================================================

async function createReviewRecords(
	context)
{
	const { reviews, reviewsTable } = context;
	const reviewRecordsByInitialID = {};

	await output.markdown(`Creating ${reviews.length} review records...`);

	await loopChunks(reviews, async (chunk) => {
		const records = await reviewsTable.createRecordsAsync(chunk);

		chunk.forEach((review, i) => {
			const { fields: { [ReviewFields.InitialID]: initialID } } = review;

			reviewRecordsByInitialID[initialID] = { id: records[i] };
		});
	});

	context.reviewRecordsByInitialID = reviewRecordsByInitialID;
}

// ====================================================================================================================
// update submissions with associated Project ID
// ====================================================================================================================

async function updateSubmissionsWithProjectID(
	context)
{
	const { reviewsTable, submissionRecordIDsByResponseByFormID, reviewRecordsByInitialID } = context;

	for (const [formID, submissionRecordIDsByResponse] of entries(submissionRecordIDsByResponseByFormID)) {
		const updatedSubmissions = [];

		for (const [initialID, reviewRecordID] of entries(reviewRecordsByInitialID)) {
			const record = await reviewsTable.selectRecordAsync(reviewRecordID.id);
			const projectID = record.getCellValue("Project ID");
			const fields = {
					// the Project ID on the review is a number, but the PROJECT_ID field on the submissions is a string.  ffs.
				[SubmissionFields.ProjectID]: String(projectID)
			};
			const submissionRecords = submissionRecordIDsByResponse.get(initialID);

			if (submissionRecords) {
				submissionRecords.forEach(({ id }) => updatedSubmissions.push({ id, fields }));
			}
		}

		if (updatedSubmissions.length) {
			await output.markdown(`Updating "${Forms[formID].name}" submissions with Project IDs...`);

			await loopChunks(updatedSubmissions, async (chunk) => submissionsTablesByFormID[formID].updateRecordsAsync(chunk));
		}
	}
}

// ====================================================================================================================
// create metadata items associated with the reviews we created above
// ====================================================================================================================

async function createMetadataRecords(
	context)
{
	const { metadataTable, metadataItems, reviewRecordsByInitialID } = context;
	const metadataRecords = [];
	const skippedNumbers = new Set();

	for (const item of metadataItems) {
		const initialID = item.initialID ?? item.responseID;
		const reviewRecord = reviewRecordsByInitialID[initialID];

			// ignore metadata for any rogue forms that got scraped
		if (reviewRecord && Forms[item.formID]) {
			const fields = MetadataTableFields.reduce((result, { name, key }) => ({
				...result,
				[name]: key
					? item[key]
						// the linked record field has an empty key value, since it doesn't exist in the JSON,
						// and must be wrapped in an array
					: [reviewRecord]
			}), {});

				// this field is expecting a string, so convert the number
			fields["Response Number"] = String(fields["Response Number"]);
			fields["Response ID"] = initialID;
			fields["Form"] = { name: Forms[item.formID].name };
			metadataRecords.push({ fields });
		} else {
			skippedNumbers.add(initialID);
		}
	}

	if (skippedNumbers.size > 0) {
		await output.markdown(`Skipping metadata response numbers with no matching reviews:\n\n${[...skippedNumbers].join(", ")}`);
	}

	await output.markdown(`Starting metadata import...`);

	await loopChunks(metadataRecords, (chunk) => metadataTable.createRecordsAsync(chunk));
}

// ====================================================================================================================
// fill reviewRecordsByInitialID from the existing reviews
// ====================================================================================================================

async function fillInReviewRecordsByInitialID(
	context)
{
	let { reviewsTable, reviewRecordsByInitialID } = context;

	if (!reviewRecordsByInitialID) {
		const reviews = await getRecordObjects(reviewsTable, values(ReviewFields));

		reviewRecordsByInitialID = fromEntries(reviews.map((review) =>
			[review[ReviewFields.InitialID], { id: review._id }]
		));

		return {
			...context,
			reviewRecordsByInitialID,
		};
	}
}

// ====================================================================================================================
// associate existing metadata items with the reviews
// ====================================================================================================================

async function connectMetadataRecords(
	context)
{
	let { metadataTable, reviewsTable, reviewRecordsByInitialID } = context;
	const metadataRecords = (await getRecordObjects(metadataTable, ["Response ID", "Form"]));
	const linkedFieldName = MetadataTableFields.at(-1).name;
	const skippedNumbers = new Set();
	const updatedRecords = [];

	if (!reviewRecordsByInitialID) {
		const reviews = await getRecordObjects(reviewsTable, values(ReviewFields));

		reviewRecordsByInitialID = fromEntries(reviews.map((review) => [review[ReviewFields.InitialID], review]));
	}

	for (const record of metadataRecords) {
		const initialID = record["Response ID"];
		const reviewRecord = reviewRecordsByInitialID[initialID];

			// ignore metadata for any rogue forms that got scraped
		if (reviewRecord && Forms[record.Form]) {
			const { id } = reviewRecord;
			const fields = { [linkedFieldName]: [{ id }] };

			updatedRecords.push({ id: record._id, fields });
		} else {
			skippedNumbers.add(initialID);
		}
	}

	if (skippedNumbers.size > 0) {
		await output.markdown(`Skipping metadata response numbers with no matching reviews:\n\n${[...skippedNumbers].join(", ")}`);
	}
console.log(updatedRecords);

	await output.markdown(`Starting metadata linking...`);

	await loopChunks(updatedRecords, async (chunk) => metadataTable.updateRecordsAsync(chunk));
}

}

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

		for (const fn of fns) {
			if (typeof fn !== "function") {
				continue;
			} else if (fn === console.log) {
				console.log("current context:\n", context);
				continue;
			}

			timeStart(fn.name);

			const result = await fn(context);

			timeEnd(fn.name);

			if (result === true) {
				break;
			} else if (result && typeof result === "object") {
				context = result;
			}
		}

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

function status() {
	const ScreendoorToProjectStatus = {
		"Approved": "Approved",
		"Archived": "Archived",
		"Build-out": "Build-out",
		"Denied": "Denied",
		"Follow up Form - Not Reviewed": null,
		"Follow up Form - Reviewed": null,
		"On Hold": "On-Hold",
		"On Hold (Portability)": "On-Hold (portability)",
		"Parking Lot": "Parking Lot",
		"Processing": "Processing",
		"Submitted": "Submitted",
		"Submitted - pending initial OOC review": "Submitted-PIR",
		"Test Account": null,
		"Withdrawn": "Withdrawn"
	};
	const LabelToStatusFields = {
		"FUF - Reviewed, follow up needed": [null, null],
		"FUF - not reviewed yet": [null, null],
		"Fire - Approved": [null, null],
		"OOC - Approved to Occupy": [null, "Lease Approved"],
		"OOC(Conviction H.) - Approved": [null, null],
		"OOC(Land-Use) - sent for review": [null, null],
		"OOC(Plan Prelim) - Referred": [null, null],
		"Plan (Prelim) - Rejected, other reason": ["Rejected", null],
		"Plan(Land-Use) - Approved": ["Land Use Approved", null],
		"Plan(Prelim) - Need more info": ["More Info Needed", null],
		"Plan(Prelim) - Pre-existing approval in place": ["Pre-Existing Approval", null],
		"Plan(Prelim) - Rejected, improper zoning": ["Rejected", null],
		"Plan(Prelim) - Zoning Compliant, additional approval required": ["Zoning Compliant", null],
		"Police(Security) - Reviewed": [null, null]
	};

	function getProjectStatusFields(
		status,
		labels)
	{
		const fields = {};
		const projectStatus = ScreendoorToProjectStatus[status];

		projectStatus && (fields["Project Status"] = { name: projectStatus });

		labels?.forEach((label) => {
			const [informalZoningReview, proofToOccupy] = LabelToStatusFields[label] || [];

			informalZoningReview && (fields["Informal Zoning Review"] = { name: informalZoningReview });
			proofToOccupy && (fields["Proof to Occupy"] = { name: proofToOccupy });
		});

		return fields;
	}

	return {
		getProjectStatusFields
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
