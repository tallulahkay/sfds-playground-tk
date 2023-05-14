import { camelCase, clean } from "./utils/string";

type JSON = Record<string, any>;

type ComponentProcessor = (
	node: InstanceNode,
	string: string) => object;

const DefaultProcessor: ComponentProcessor = (node: InstanceNode, type: string) => ({
		...getComponentProperties(node),
		type
});

const ComponentProcessors: Record<string, ComponentProcessor> = {
	"Checkbox": DefaultProcessor,
	"Text field": (node: InstanceNode, type: string) => {
		const {
			errorText,
			helpText,
			labelText,
			placeholderText,
			required,
			showErrorMessage,
			showHelpText,
			showPlaceholderText
		} = getComponentProperties(node);
		const json: JSON = {
			type: "textfield",
			key: camelCase(labelText),
			label: labelText,
			tableView: true,
			input: true
		};

		if (required) {
			json.validate = {
				required: true,
			}

			if (showErrorMessage) {
				json.validate.customMessage = errorText
			}
		}

		if (showHelpText) {
			json.description = helpText;
		}

		if (showPlaceholderText) {
			json.placeholder = placeholderText;
		}

		return json;
	},
	"Text area": (node: InstanceNode, type: string) => {
		const {
			errorText,
			helpText,
			labelText,
			required,
			showErrorMessage,
			showHelpText
		} = getComponentProperties(node);
		const json: JSON = {
			type: "textarea",
			key: camelCase(labelText),
			label: labelText,
			autoExpand: false,
			tableView: true,
			input: true
		};

		if (required) {
			json.validate = {
				required: true,
			}

			if (showErrorMessage) {
				json.validate.customMessage = errorText
			}
		}

		if (showHelpText) {
			json.description = helpText;
		}

		return json;
	},
	"Navigational buttons": (node: InstanceNode, type: string) => ({ type }),
} as const;

function getComponentProperties(
	node: InstanceNode)
{
	const { componentProperties } = node;

	return Object.fromEntries(Object.entries(componentProperties).map(
		([key, value]) => [clean(key), value.value])
	);
}

function getComponentType(
	node: InstanceNode)
{
	const { mainComponent } = node;
	let type = "UNKNOWN";

	if (mainComponent) {
		if (mainComponent.parent) {
			type = mainComponent.parent.name;
		} else {
			type = mainComponent.name;
		}
	}

	return type;
}

export function getFormioJSON(
	node: InstanceNode)
{
	const type = getComponentType(node);
	const processor = ComponentProcessors[type];

	if (processor) {
		return processor(node, type);
	}

	return null;
}
