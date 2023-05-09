import fs from "fs-extra";
import jmespath from "jmespath";
import { writeToPath } from "fast-csv";
import * as XLSX from "xlsx";

XLSX.set_fs(fs);

const Headers = ["Type", "Key", "Label", "Error Label"];

	// annoyingly, there's no short form for specifying a mapping from a key name
	// to the same name, so this utility function will generate the string
const keys = (keyString) => `.{${
	keyString.split(/\s*,\s*/)
		.map((key) => key + ":" + key)
		.join(", ")
}}`;
const { search } = jmespath;

const allForms = fs.readJsonSync("dev-forms.json");
const oocForms = allForms.filter(({ name }) => name.startsWith("ooc"));
const wb = { SheetNames: [], Sheets: {} };

oocForms.forEach((form) => {
	const { name } = form;
	const rows = [Headers];
	const panels = search(form, "components[?type=='panel']" + keys("title, key, components"));

	panels.forEach(({ title, key, components }) => {
		rows.push([]);
		rows.push(["panel", key, title]);
		components.forEach(({ type, key, label, errorLabel }) => rows.push([type, key, label, errorLabel ?? ""]));
	});

	console.log(name);

	const ws = XLSX.utils.aoa_to_sheet(rows);

	wb.SheetNames.push(name);
	wb.Sheets[name] = ws;

//	fs.writeJsonSync(`${name}.json`, rows);
//	writeToPath(`${name}.csv`, rows);
});

XLSX.writeFile(wb, "OOC Form Fields.xlsx");
