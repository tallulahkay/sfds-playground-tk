 	// these are the names of the columns in the mapping doc that specify the name and type of each field
const FieldNameColName = "Airtable field name".toLowerCase();
const FieldTypeColName = "Airtable Field types".toLowerCase();
const FieldOptionsColName = "Options".toLowerCase();
const ScreendorNameColName = "Screendoor ID".toLowerCase();
const ChoiceDelimiterPattern = /[\n\r\s,]+/;
const ScreendoorFieldPattern = /^\w+$/;

	// options are stored as multiline text, so split the string and store each one
	// as an object with a name field
const createChoices = (names = "") => ({ choices: names.split(ChoiceDelimiterPattern).map((name) => ({ name })) });

	// map the type strings used in the mapping doc to the actual API types
const TypeMapping = {
	"Single line text": "singleLineText",
	"Long text": "multilineText",
	"Rich text": "richText",
	"Attachment": "multipleAttachments",
	"Checkbox": "checkbox",
	"Multiple select": "multipleSelects",
	"Single select": "singleSelect",
	"Collaborator": "singleCollaborator",
	"Date": "date",
	"Phone number": "phoneNumber",
	"Email": "email",
	"URL": "url",
	"Number": "number",
	"Currency": "currency",
	"Percent": "percent",
	"Duration": "duration",
	"Rating": "rating",
	"Barcode": "barcode",
};

const destinationTable = await input.tableAsync("Choose a destination table:");

const jsonFile = await input.fileAsync(
	"Choose a .json file containing a Screendoor record:",
	{
		allowedFileTypes: [".json"],
	}
);

const screendoorData = jsonFile.parsedContents;

const file = await input.fileAsync(
	"Choose a .xlsx file containing field mappings:",
	{
		allowedFileTypes: [".xlsx"],
			// set this to false, even though we expect a header, so that each row is an array
			// of cells, instead of an object with key/value pairs
		hasHeaderRow: false
	}
);

const data = file.parsedContents;
const sheets = Object.keys(data).filter(name => name !== "field types");

const sheetName = await input.buttonsAsync(
	"Choose a sheet to import:",
	sheets
);

const [header, ...rows] = data[sheetName];
const colByName = Object.fromEntries(Object.entries(header)
		// lowercase the column name when setting up the mapping to the column number
		// so that we can do a case-insensitive match
	.map(([col, name]) => [name.toLowerCase(), +col]));

const fieldNameCol = colByName[FieldNameColName];
const fieldTypeCol = colByName[FieldTypeColName];
const fieldOptionsCol = colByName[FieldOptionsColName];
const screendoorNameCol = colByName[ScreendorNameColName];
const missingFields = [FieldNameColName, FieldTypeColName, FieldOptionsColName, ScreendorNameColName].filter((name) => typeof colByName[name] === "undefined");

if (missingFields.length) {
	console.error(`Can't find some column headers in spreadsheet: ${missingFields.map(name => `'${name}'`).join(", ")}`);

	return;
}

console.log(FieldNameColName, fieldNameCol, FieldTypeColName, fieldTypeCol, ScreendorNameColName, screendoorNameCol);

const screendoorRecords = [].concat(screendoorData);
const newRecords = [];

for (const screendoorRecord of screendoorRecords) {
	const { id, sequential_id, initial_response_id, created_at, responder, responses } = screendoorRecord;
	const [firstName, ...lastName] = responder.name.split(/\s+/);
	const newRecord = {
		RESPONSE_ID: String(id),
		RESPONSE_NUM: String(sequential_id),
		"Initial Screendoor Response ID": String(initial_response_id),
		Submitted: created_at,
		firstName,
		lastName: lastName.join(" "),
		email: responder.email,
	};
	let blankRowCount = 0;

	for (const row of rows) {
		const {
			[fieldNameCol]: name,
			[fieldTypeCol]: originalType,
			[fieldOptionsCol]: choices,
			[screendoorNameCol]: screendoorID,
		} = row;

		if (name && screendoorID && ScreendoorFieldPattern.test(screendoorID)) {
			const type = TypeMapping[originalType];
			const screendoorValue = responses[screendoorID];
			const screendoorType = typeof screendoorValue;

			if (!type.includes("Select") && !["object", "undefined"].includes(screendoorType)) {
				newRecord[name] = screendoorValue;
			}

			blankRowCount = 0;
		} else {
			blankRowCount++

console.log("== skipping", blankRowCount, name, screendoorID, ScreendoorFieldPattern.test(screendoorID));

			if (blankRowCount > 15) {
				break;
			}
		}
	}

	console.log(newRecord);

	newRecords.push({ fields: newRecord });

	if (blankRowCount > 3) {
		break;
	}
}

await destinationTable.createRecordsAsync(newRecords);

output.markdown(`Created **${newRecords.length} records**.`);
