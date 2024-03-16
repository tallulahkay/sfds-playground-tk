import fs from "node:fs/promises";
import { parse } from "yaml";
import { generateForm } from "./generateForm.js";

const yaml = await fs.readFile("test.yaml", "utf8");
let form;

try {
	form = parse(yaml);
} catch (e) {
	console.error(e);
	process.exit(1);
}

console.log(JSON.stringify(generateForm(form), null, 2));
