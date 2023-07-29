const destinationTable = await input.tableAsync("Choose a destination table:");

const file = await input.fileAsync(
	"Choose a .xlsx file containing field names, with a header in the first row:",
	{
		allowedFileTypes: [".xlsx"],
			// set this to false, even though we expect a header, so that each row is an array
			// of cells, instead of an object with key/value pairs
		hasHeaderRow: false
	}
);

const data = file.parsedContents;
const sheets = Object.keys(data);
let sheetName = sheets[0];

if (sheets.length > 1) {
	sheetName = await input.buttonsAsync(
		"Choose a sheet to import:",
		sheets
	);
}

const [header, ...rows] = data[sheetName];
const tableFields = [];
let blankRowCount = 0;

for (const row of rows) {
	if (row.length) {
		tableFields.push({
			name: row.join(" - "),
			type: "richText"
		});
	} else if (++blankRowCount > 3) {
		break;
	}
}

const existingFields = destinationTable.fields.map(({ name }) => name);

for (const { name, type } of tableFields) {
	if (existingFields.includes(name)) {
		output.markdown(`Ignoring field \`"${name}"\`, which already exists.`);
	} else {
		await destinationTable.createFieldAsync(name, type);
	}
}

output.markdown(`**${tableFields.length}** fields created in table **${destinationTable.name}**.`);
