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
	const { input, output = "Screendoor.xlsx" } = flags;

	return { command, flags: { input, output } };
}

const Headers = ["ID", "Type", "Label", "Required", "Options"];

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
const formPaths = globSync(join(input, "**/forms.json"), { windowsPathsNoEscape: true });
const wb = { SheetNames: [], Sheets: {} };

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
