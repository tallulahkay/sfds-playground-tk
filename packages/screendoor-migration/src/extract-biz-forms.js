import fs from "fs-extra";
import parseArgs from "minimist";
import jmespath from "jmespath";
import * as XLSX from "xlsx";

XLSX.set_fs(fs);

function getArgs(
	argString = process.argv.slice(2))
{
	const { _: [command], ...flags } = parseArgs(argString);
	const { input, output = "Screendoor Business Permit Forms.xlsx" } = flags;

	return { command, flags: { input, output } };
}

const SkipTypes = [
	"page_break",
	"section_break",
	"block_of_text",
];
const Headers = ["Label", "Airtable Field types", "Conditional", "Options", "Screendoor ID", "Screendoor Type", "Required"];
const FormNames = {
    "5804": "Initial cannabis application",
    "5885": "Community Outreach and Good Neighbor Policy",
    "5886": "Staffing and Labor Peace Agreements",
    "5887": "Security plan and premises diagram",
    "6162": "General business operations",
    "6419": "Storefront retail operations",
    "6420": "Delivery operations",
    "6425": "Distributor operations",
    "6428": "Manufacturing operations",
    "6431": "Testing operations",
    "6437": "Cultivation operations",
    "6447": "Upload documents for other agencies",
    "6813": "Draft - Police - Livescan Conviction History assessment",
    "7927": "DRAFT - Business Profile2",
    "7964": "DRAFT - Amendment to approved applications",
    "8110": "Renewal - 1st year",
    "8142": "Equity Incubator",
    "8481": "DRAFT- Additional Information Required for Tier 3 Application",
    "9026": "Renewal - 2nd year",
    "9396": "Delivery Operation",
    "9436": "Renewal - 3rd Year"
};
const TypeMap = {
	checkboxes: "Multiple select",
	radio: "Single select",
	confirm: "Checkbox",
	paragraph: "Long text",
	date: "Date",
	price: "Currency",
	number: "Number",
	phone: "Phone number",
	file: "URL",
};

const { search } = jmespath;

const { flags: { input, output } } = getArgs();
	// create an empty workbook object to store the sheets before outputting the file
const wb = { SheetNames: [], Sheets: {} };

fs.readJsonSync(input).forEach((form) => {
	const name = FormNames[form.id].slice(0, 31);
	const { field_data } = form;
	const rows = [Headers];

	field_data.forEach((field) => {
		const { id, field_type, label, required, options } = field;
		let optionsText = "";

		if (!SkipTypes.includes(field_type)) {
				// default to Single line text for most fields in Airtable
			const airtableType = TypeMap[field_type] || "Single line text";

			if (options && options.length) {
				optionsText = search(field, "options[].label")
					.join("\n");
			}

			rows.push([label, airtableType, null, optionsText, id, field_type, required]);
		}
	});

	console.log(name);

	const ws = XLSX.utils.aoa_to_sheet(rows);

	wb.SheetNames.push(name);
	wb.Sheets[name] = ws;
});

XLSX.writeFile(wb, output);
