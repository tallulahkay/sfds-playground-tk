const ComponentDefaults = {
	form: {},
	panel: {
		collapsible: false,
		tableView: false,
		input: false,
	},
	textfield: {
		tableView: true,
		input: true,
	},
	email: {
		tableView: true,
		input: true,
	},
	checkbox: {
		tableView: true,
		input: true,
	},
	selectboxes: {
		tableView: false,
		inputType: "checkbox",
	},
};

// TODO: add support for horizontal rules, date fields

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

	if ("required" in data) {
		result.validate = {
			...(result.validate ?? {}),
			required: data.required,
		};
		delete result.required;
	}

	if (components) {
		result.components = components.map((comp) => processComponent(comp, uniqueKey));
	}

	return result;
}
