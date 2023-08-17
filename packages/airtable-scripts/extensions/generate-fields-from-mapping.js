	// these are the names of the columns in the mapping doc that specify the name and type of each field
const FieldNameColName = "Airtable field name".toLowerCase();
const FieldTypeColName = "Airtable Field types".toLowerCase();
const FieldOptionsColName = "Options".toLowerCase();
const NotesPattern = /^([\w\s]+) Notes$/;
const ChoiceDelimiterPattern = /[\n\r\s,]+/;

const createFormula = (sectionName) =>
`IF({${sectionName} Notes},
"\\n" &
{Last modified for display - Submissions} &
":\\n" &
{${sectionName} Notes} &
"\\n\\n----------\\n" &
{Previous ${sectionName} Notes},
{Previous ${sectionName} Notes}
)`;

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
const DefaultType = "singleLineText";
const FieldOptions = {
	singleSelect: createChoices,
	multipleSelects: createChoices,
	date: () => ({ dateFormat: { name: "iso" } }),
	number: () => ({ precision: 0 }),
	percent: () => ({ precision: 0 }),
	currency: () => ({ precision: 0, symbol: "$" }),
	duration: () => ({ durationFormat: "h:mm" }),
	checkbox: () => ({ icon: "check", color: "grayBright" }),
};

const destinationType = await input.buttonsAsync(
	"Choose a destination for the imported fields:",
	[
		{
			label: "New table",
			value: "new"
		},
		{
			label: "Existing table",
			value: "existing"
		},
	]
);

let destinationTable;
let destinationTableName;

if (destinationType === "new") {
	destinationTableName = await input.textAsync("Enter a name for the new table:");

	if (base.tables.some(({ name }) => name === destinationTableName)) {
		output.markdown(`A table named **${destinationTableName}** already exists.`);

		return;
	}
} else {
	destinationTable = await input.tableAsync("Choose a destination table:");
	destinationTableName = destinationTable.name;
}

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
const missingFields = [FieldNameColName, FieldTypeColName, FieldOptionsColName].filter((name) => typeof colByName[name] === "undefined");

if (missingFields.length) {
	console.error(`Can't find some column headers in spreadsheet: ${missingFields.map(name => `'${name}'`).join(", ")}`);

	return;
}

const tableFields = [];
let blankRowCount = 0;

for (const row of rows) {
	const {
		[fieldNameCol]: name,
		[fieldTypeCol]: originalType,
		[fieldOptionsCol]: choices
	} = row;

	if (name && originalType) {
		let type = TypeMapping[originalType];

		if (!type) {
			console.error(`Can't set "${name}" to type "${originalType}".`);
			type = DefaultType;
		}

		const field = { name, type };

		if (FieldOptions[type]) {
				// run the helper function to add any necessary options to this field type
			field.options = FieldOptions[type](choices);
		}

		tableFields.push(field);

		const notesMatch = name.match(NotesPattern);

		if (notesMatch) {
			const sectionName = notesMatch[1];

				// set the type of the notes field we just pushed to richText, since we want
				// formatting support in all notes fields
			tableFields[tableFields.length - 1].type = "richText";

				// for each notes field, we also want to add an associated previous field
				// and a formula field
			tableFields.push(
				{
					name: `Previous ${sectionName} Notes`,
					type: "richText"
				},
				{
					name: `${sectionName} Notes formula`,
						// we can't create a formula field with a script, so make it
						// a rating field with a star just so it's easy to spot
					type: "rating",
					options: {
						icon: "star",
						max: 5,
						color: "yellowBright"
					}
				},
			);

				// display the formula for this field for easy copying
			output.markdown(
`Formula for **${sectionName}**:
\`\`\`
${createFormula(sectionName)}
\`\`\`

`
			);
		}
	} else {
		blankRowCount++

		if (blankRowCount > 3) {
			break;
		}
	}
}

if (destinationType === "new") {
	await base.createTableAsync(destinationTableName, tableFields);
} else {
	const existingFields = destinationTable.fields.map(({ name }) => name);

	for (const { name, type, options } of tableFields) {
		if (existingFields.includes(name)) {
			output.markdown(`Ignoring field \`"${name}"\`, which already exists.`);
		} else {
			await destinationTable.createFieldAsync(name, type, options);
		}
	}
}

output.markdown(`**${tableFields.length}** fields created in table **${destinationTableName}**.`);
