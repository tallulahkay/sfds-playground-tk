output.markdown("# Tables with bad options strings\n\n");

const goodTables = [];

for (const table of base.tables) {
	const badOptionFields = [];
	let selectFieldCount = 0;

	for (const field of table.fields) {
			// look for both "multipleSelects" and "singleSelect" fields
		if (field.type.includes("Select")) {
			const { name, options: { choices } } = field;
			const badChoices = choices
				.map(({ name }) => name)
				.filter((name) => /\r/.test(name));

			if (badChoices.length) {
				badOptionFields.push(`#### ${name}\n* ${badChoices.join("\n* ")}\n\n\n`)
			}

			selectFieldCount++;
		}
	}

	if (badOptionFields.length) {
		output.markdown(`## ${table.name}\n${badOptionFields.join("\n")}`);
	} else {
		goodTables.push(`* ${table.name} (${selectFieldCount})\n`);
	}
}

output.markdown(`# Tables with good option strings\n\n${goodTables.join("")}`);
