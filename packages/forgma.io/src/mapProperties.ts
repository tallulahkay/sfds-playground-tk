import { FigmaComponentProps, JSON } from "./types";

const isTrue = (key: string) => (props: FigmaComponentProps) => props[key];

const PropertyProcessors: Record<string, any> = {
	labelText: "label",
	helpText: [isTrue("showHelpText"), "description"],
	placeholderText: [isTrue("showPlaceholderText"), "placeholder"],
	required: (props: FigmaComponentProps) => {
		if (props.required) {
			const validate: JSON = { required: true };

			if (props.showErrorMessage) {
				validate.customMessage = props.errorText;
			}

			return ["validate", validate];
		}
	}
};

export function mapProperties(
	props: FigmaComponentProps)
{
	const json: JSON = {};

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
