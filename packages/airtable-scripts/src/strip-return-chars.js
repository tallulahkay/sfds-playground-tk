const table = await input.tableAsync("Choose a table to fix:");

for (const field of table.fields) {
		// look for both "multipleSelects" and "singleSelect" fields
	if (field.type.includes("Select")) {
		const { name, options: { choices } } = field;
		const badChoices = choices.filter(({ name }) => /\r/.test(name));

		if (badChoices.length) {
			const fixedChoices = choices.map(({ name, ...choice }) => ({
				...choice,
				name: name.replaceAll("\r", "")
			}));

			output.markdown(`Fixing **${name}**`);
			await field.updateOptionsAsync({ choices: fixedChoices });
		}
	}
}
