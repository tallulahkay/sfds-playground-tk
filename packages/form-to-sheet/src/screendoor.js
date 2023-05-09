import fs from "fs-extra";
import jmespath from "jmespath";
import { writeToPath } from "fast-csv";
import * as XLSX from "xlsx";

XLSX.set_fs(fs);

const Headers = ["ID", "Type", "Label", "Required", "Options"];

	// annoyingly, there's no short form for specifying a mapping from a key name
	// to the same name, so this utility function will generate the string
const keys = (keyString) => `.{${
	keyString.split(/\s*,\s*/)
		.map((key) => key + ":" + key)
		.join(", ")
}}`;
const { search } = jmespath;

const allForms = fs.readJsonSync("screendoor.json");
const wb = { SheetNames: [], Sheets: {} };
const name = "equity-incubator";

allForms.forEach((form) => {
	const { field_data } = form;
	const rows = [Headers];

	field_data.forEach((field) => {
		const { id, field_type, label, required, options } = field;
		let optionsText = "";

		if (options && options.length) {
			optionsText = search(field, "options[*].label").join("\n");
		}

		rows.push([id, field_type, label, required, optionsText]);
	});

	console.log(name);

	const ws = XLSX.utils.aoa_to_sheet(rows);

	wb.SheetNames.push(name);
	wb.Sheets[name] = ws;

//	fs.writeJsonSync(`${name}.json`, rows);
//	writeToPath(`${name}.csv`, rows);
});

XLSX.writeFile(wb, "Screendoor.xlsx");
