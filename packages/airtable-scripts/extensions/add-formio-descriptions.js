{
	const FormioField = "Form.io API";
	const AirtableField = "Airtable field name";

	const fieldDescription = (formioID) => `This field is connected to form.io via "${formioID}". The connection will broken if the field names or types are changed.`;

	const table = base.getTable(cursor.activeTableId);

	const file = await input.fileAsync(
		"Choose the mapping doc .xlsx file:",
		{
			allowedFileTypes: [".xlsx"],
			hasHeaderRow: true
		}
	);

	const data = file.parsedContents;
	const sheets = Object.keys(data);
	let sheetName = sheets[0];

	if (sheets.length > 1) {
		sheetName = await input.buttonsAsync(
			`Choose the sheet to apply to "${table.name}":`,
			sheets
		);
	}

	const rows = data[sheetName];
	const descriptions = [];
	const nonFormioFields = [];

	rows.forEach((row) => {
		const { [FormioField]: formio, [AirtableField]: airtable } = row;

		if (airtable) {
			if (formio) {
				descriptions.push([airtable, fieldDescription(formio)]);
			} else {
				nonFormioFields.push(airtable);
			}
		}
	});

	console.log("Airtable fields not used in formio:\n", nonFormioFields.join("\n"));
	console.log(`Updating ${descriptions.length} fields...`);

	let successCount = 0;

	for (const [fieldName, description] of descriptions) {
		try {
			const field = table.getField(fieldName);

			await field.updateDescriptionAsync(description);
			successCount++;
		} catch (e) {
			console.error(`No field named '${fieldName}'`);
		}
	}

	console.log(`${successCount} field descriptions updated.`);
}
