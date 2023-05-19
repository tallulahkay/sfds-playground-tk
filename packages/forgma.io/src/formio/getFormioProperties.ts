import { FigmaComponentProps, FormioJSON } from "@/types";

const DefaultStrings: Record<string, [string, string]> = {
	showHelpText: ["helpText", "Help text would go here."],
	showErrorMessage: ["errorText", "Error message would go here."]
};

const isTrue = (key: string) => (props: FigmaComponentProps) => {
	const defaultCheck = DefaultStrings[key];

	if (defaultCheck) {
		const [stringKey, defaultString] = defaultCheck;

		return props[key] && props[stringKey] !== defaultString;
	} else {
		return props[key];
	}
};

const PropertyProcessors: Record<string, any> = {
	labelText: "label",
	checkboxText: "label",
	helpText: [isTrue("showHelpText"), "description"],
	placeholderText: [isTrue("showPlaceholderText"), "placeholder"],
	required: (props: FigmaComponentProps) => {
		if (props.required) {
			const validate: FormioJSON = { required: true };

				// only add the error message if it's not set to the default string
			if (isTrue("showErrorMessage")(props)) {
				validate.customMessage = props.errorText;
			}

			return ["validate", validate];
		}
	}
};

export function getFormioProperties(
	props: FigmaComponentProps)
{
	const json: FormioJSON = {};

	for (const [key, value] of Object.entries(props)) {
		const processor = PropertyProcessors[key];

		if (typeof processor === "string") {
			json[processor] = value;
		} else if (Array.isArray(processor)) {
			const [otherPropIsTrue, jsonKey] = processor;

			if (otherPropIsTrue(props)) {
				json[jsonKey] = value;
			}
		} else if (typeof processor === "function") {
			const result = processor(props);

			if (Array.isArray(result)) {
				const [jsonKey, jsonValue] = result;

				json[jsonKey] = jsonValue;
			}
		}
	}

	return json;
}
