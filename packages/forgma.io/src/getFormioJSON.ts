import { FigmaComponentProps, JSON } from "./types";
import { mapProperties } from "./mapProperties";
import { camelCase, clean } from "./utils/string";
import { isInstance } from "./utils/plugin";

type ComponentProcessor = (
	node: InstanceNode,
	string: string) => object;

type FormioOptionProps = {
	label: string,
	value: string,
	shortcut: string
};

type FormioOptionInfo = {
	values: FormioOptionProps[],
	defaultValue: Record<string, boolean>
};

const DefaultProcessor: ComponentProcessor = (node: InstanceNode, type: string) => ({
		...getComponentProperties(node),
		type
});

const ComponentProcessors: Record<string, ComponentProcessor> = {
	"Checkbox": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "selectboxes",
			key: camelCase(props.labelText),
			tableView: false,
			inputType: "checkbox",
			optionsLabelPosition: "right",
			...mapProperties(props),
			...getFormioOptionProperties(node)
		};
	},
	"Radio": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "radio",
			key: camelCase(props.labelText),
			tableView: false,
			input: true,
			optionsLabelPosition: "right",
			...mapProperties(props),
			...getFormioOptionProperties(node)
		};
	},
	"Checkbox text": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "checkbox",
			key: camelCase(props.checkboxText),
			tableView: false,
			input: true,
			defaultValue: props.type === "Selected",
			...mapProperties(props)
		};
	},
	"Text field": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "textfield",
			key: camelCase(props.labelText),
			tableView: true,
			input: true,
			...mapProperties(props)
		};
	},
	"Text area": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "textarea",
			key: camelCase(props.labelText),
			autoExpand: false,
			tableView: true,
			input: true,
			...mapProperties(props)
		};
	},
	"Navigational buttons": (node: InstanceNode, type: string) => ({ type }),
} as const;

function getFormioOptionProperties(
	node: InstanceNode)
{
	return node.children
		.filter(isInstance)
		.filter(({ visible }) => visible)
		.reduce((result: FormioOptionInfo, node) => {
			const { rowText, text, status } = getComponentProperties(node);
			const label = (rowText || text) as string;
			const value = camelCase(label);

			result.values.push({
				label,
				value,
				shortcut: ""
			});
			result.defaultValue[value] = status === "Selected";

			return result;
		}, { values: [], defaultValue: {} });
}

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
