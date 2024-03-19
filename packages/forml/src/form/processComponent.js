const TableInputTrue = {
	tableView: true,
	input: true,
};
const TableInputFalse = {
	tableView: false,
	input: false,
};
const ComponentProperties = [
	["panel", {
		collapsible: false,
	}],
	["textfield"],
	["email", {
		validateOn: "blur",
	}],
	["phoneNumber", {
		inputMask: "999-999-9999",
		validateOn: "blur",
	}],
	["checkbox"],
	["radio"],
	["day"],
	["selectboxes", {
		inputType: "checkbox",
	}],
	["select", {
		widget: "html5",
		searchEnabled: false,
	}],
	["fieldSet",
		TableInputFalse
	],
	["htmlelement", {
			// since we allow just the tag key to be included, make sure the actual
			// type is specified as well
		type: "htmlelement",
		...TableInputFalse,
	}],
	["columns",
		TableInputFalse
	],
];
const ComponentDefaults = ComponentProperties.reduce((result, [key, props]) => ({
	...result,
	[key]: {
		...TableInputTrue,
		...props
	},
}), {
		// we don't want to add any defaults to the form, but we do want it in this
		// hash so its components array gets handled in processComponent() below
	form: {}
});

export function processComponent(
	data,
	uniqueKey)
{
	const { type, key, label, components, columns } = data;
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

	if (label?.endsWith("*")) {
		result.label = label.slice(0, -1);
		result.required = true;
	}

	if (typeof result.required === "boolean") {
		result.validate = {
			...(result.validate ?? {}),
			required: result.required,
		};
		delete result.required;
	}

	if (components) {
		result.components = components.map((comp) => processComponent(comp, uniqueKey));
	}

	if (columns) {
			// each column has its own components that need to be processed
		columns.forEach((col) => col.components =
			col.components.map((comp) => processComponent(comp, uniqueKey)));
	}

	return result;
}
