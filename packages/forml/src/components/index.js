const ComponentDefaults = {
	form: {},
	textfield: {
		tableView: true,
		input: true,
	},
	selectboxes: {
		tableView: false,
		inputType: "checkbox",
	},
};

export function processComponent(
	data,
	uniqueKey)
{
	const { type, key, label, components } = data;
	const defaults = ComponentDefaults[type];

	if (!defaults) {
		throw new Error(`Unknown component type: ${type}`);
	}

	const result = {
		...defaults,
		...data,
	};

	if (type !== "form") {
		result.key = uniqueKey(key ?? label);
	}

	if (components) {
		result.components = components.map((comp) => processComponent(comp, uniqueKey));
	}

	return result;
}
