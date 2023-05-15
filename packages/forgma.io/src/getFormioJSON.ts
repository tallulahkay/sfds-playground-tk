import { FigmaComponentProps, JSON } from "./types";
import { mapProperties } from "./mapProperties";
import { camelCase, clean } from "./utils/string";
import { isInstance } from "./utils/plugin";

type ComponentProcessor = (
	node: InstanceNode,
	string: string) => object;

type FormioCheckboxProps = {
	label: string,
	value: string,
	shortcut: string
};

type CheckboxInfo = {
	values: FormioCheckboxProps[],
	defaultValue: Record<string, boolean>
};

const DefaultProcessor: ComponentProcessor = (node: InstanceNode, type: string) => ({
		...getComponentProperties(node),
		type
});

const ComponentProcessors: Record<string, ComponentProcessor> = {
	"Checkbox": (node) => {
		const props = getComponentProperties(node);
		const checkboxInfo = node.children
			.filter(isInstance)
			.filter(({ visible }) => visible)
			.reduce((result: CheckboxInfo, node) => {
				const { rowText, status } = getComponentProperties(node);
				const identifier = camelCase(rowText);

				result.values.push({
					label: rowText as string,
					value: identifier,
					shortcut: ""
				});
				result.defaultValue[identifier] = status === "Selected";

				return result;
			}, { values: [], defaultValue: {} });
		const json: JSON = {
			type: "selectboxes",
			key: camelCase(props.labelText),
			tableView: false,
			inputType: "checkbox",
			optionsLabelPosition: "right",
			...mapProperties(props),
			...checkboxInfo
		};

		return json;
	},
	"Checkbox text": (node) => {
		const props = getComponentProperties(node);
		const json: JSON = {
			type: "checkbox",
			key: camelCase(props.checkboxText),
			tableView: false,
			input: true,
			defaultValue: props.type === "Selected",
			...mapProperties(props)
		};

		return json;
	},
	"Text field": (node) => {
		const props = getComponentProperties(node);
		const json: JSON = {
			type: "textfield",
			key: camelCase(props.labelText),
			tableView: true,
			input: true,
			...mapProperties(props)
		};

		return json;
	},
	"Text area": (node) => {
		const props = getComponentProperties(node);
		const json: JSON = {
			type: "textarea",
			key: camelCase(props.labelText),
			autoExpand: false,
			tableView: true,
			input: true,
			...mapProperties(props)
		};

		return json;
	},
	"Navigational buttons": (node: InstanceNode, type: string) => ({ type }),
} as const;

function getComponentProperties(
	node: InstanceNode): FigmaComponentProps
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
