import { join, basename, dirname } from "node:path";
import fs from "fs-extra";
import parseArgs from "minimist";
import { globSync } from "glob";
import jmespath from "jmespath";
import { writeToPath } from "fast-csv";
import * as XLSX from "xlsx";

XLSX.set_fs(fs);

function getArgs(
	argString = process.argv.slice(2))
{
	const { _: [command], ...flags } = parseArgs(argString);
	const { input = "../mapping.xlsx", output = "mapping-test.xlsx" } = flags;

	return { command, flags: { input, output } };
}

const NumberPattern = /^\d+$/;
const EndsInNumberPattern = /^.+\d+$/;
const YesPattern = /^\s*yes\s*$/i;

function isAddAnotherField(
	fieldName = "")
{
	const subkeys = fieldName.split(".");
	const { length } = subkeys;

	if (!fieldName || length < 2) {
		return false;
	}

	if (length == 2) {
		return NumberPattern.test(subkeys[1]);
	}

	if (length == 3) {
		return EndsInNumberPattern.test(subkeys[1]);
	}

	return false;
}


	// annoyingly, there's no short form for specifying a mapping from a key name
	// to the same name, so this utility function will generate the string
const keys = (keyString) => `.{${
	keyString.split(/\s*,\s*/)
		.map((key) => key + ":" + key)
		.join(", ")
}}`;
const { search } = jmespath;

const { flags: { input, output } } = getArgs();
	// since join will use \ in the path, we have to tell glob to ignore \ for escaping
//const formPaths = globSync(join(input, "**/forms.json"), { windowsPathsNoEscape: true });
//const wb = { SheetNames: [], Sheets: {} };

const mappingDoc = XLSX.readFileSync(input);


//const sheetName = "Community outreach";

const sheetNames = mappingDoc.SheetNames.slice(2, -4);
//console.log(sheetNames);

for (const sheetName of sheetNames) {
	const ws = mappingDoc.Sheets[sheetName];
	const [header, ...wsRows] = XLSX.utils.sheet_to_json(ws, { header: 1 });
	const fieldNameCol = header.indexOf("Airtable field name");
	const addAnotherCol = header.indexOf("Add another?");
	const rows = wsRows.map((row) => ([row[fieldNameCol], row[addAnotherCol]]));

	console.log(`\n\n# ${sheetName}\n`);

	for (const [fieldName, isAddAnother] of rows) {
		const yes = YesPattern.test(isAddAnother);
		const isAA = isAddAnotherField(fieldName);

		if (yes) {
			const icon = isAA && yes ? "✅" : "❌";

			console.log(`- ${icon} ${fieldName}`);
		} else if (!yes && isAA) {
			console.log(`- ❌ FALSE POSITIVE: ${fieldName}`);
		}
	}
}

//console.log(rows);

/*
formPaths.forEach((formPath) => {
	const [form] = fs.readJsonSync(formPath);
	const name = basename(dirname(formPath)).slice(0, 31);
	const { field_data } = form;
	const rows = [Headers];

	field_data.forEach((field) => {
		const { id, field_type, label, required, options } = field;
		let optionsText = "";

		if (options && options.length) {
			optionsText = search(field, "options[].label")
				.map((label) => `'${label}'`)
				.join("\n");
		}

		rows.push([id, field_type, label, required, optionsText]);
	});

	console.log(name);

	const ws = XLSX.utils.aoa_to_sheet(rows);

	wb.SheetNames.push(name);
	wb.Sheets[name] = ws;
});

XLSX.writeFile(wb, output);
*/
