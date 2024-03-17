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
		validateOn: "blur",
	},
	phoneNumber: {
		tableView: true,
		input: true,
		inputMask: "999-999-9999",
		validateOn: "blur",
	},
	checkbox: {
		tableView: true,
		input: true,
	},
	radio: {
		tableView: true,
		input: true,
	},
	selectboxes: {
		tableView: false,
		inputType: "checkbox",
	},
	select: {
		widget: "html5",
		searchEnabled: false,
		tableView: true,
		input: true,
	},
	fieldSet: {
		tableView: false,
		input: false,
	},
	htmlelement: {
			// since we allow just the tag key to be included, make sure the actual
			// type is specified as well
		type: "htmlelement",
		tableView: false,
		input: false,
	},
};

export function processComponent(
	data,
	uniqueKey)
{
	const { type, key, label, components } = data;
	const defaults = ComponentDefaults[type || (data.tag && "htmlelement")];

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
