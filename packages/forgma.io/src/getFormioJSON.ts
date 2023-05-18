import { FigmaComponentProps } from "./types";
import { getFormioProperties } from "./getFormioProperties";
import { camelCase, clean } from "./utils/string";
import { isInstance } from "./utils/plugin";

const AlertStylesByType: Record<string, { icon: string, iconClass: string, bg: string }> = {
	Informational: {
		icon: "alert",
		iconClass: "",
		bg: "bg-blue-1"
	},
	Success: {
		icon: "alert",
		iconClass: "",
		bg: "bg-blue-1"
	},
	Failure: {
		icon: "delete",
		iconClass: "fg-red-4",
		bg: "bg-red-1"
	}
} as const;

type ComponentProcessor = (
	node: InstanceNode,
	string: string) => object;

type FormioOptionProps = {
	label: string,
	value: string,
	shortcut: string
};

type FormioOptionValues = {
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
			...getFormioProperties(props),
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
			...getFormioProperties(props),
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
			...getFormioProperties(props)
		};
	},
	"Text field": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "textfield",
			key: camelCase(props.labelText),
			tableView: true,
			input: true,
			...getFormioProperties(props)
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
			...getFormioProperties(props)
		};
	},
	"Upload": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "file",
			key: camelCase(props.labelText),
			tableView: false,
			input: true,
			storage: "azure",
			dir: "ooc-equity-mvp",
			webcam: true,
			fileTypes: [
				{
					label: "",
					value: ""
				}
			],
			...getFormioProperties(props)
		};
	},
	"Alert callouts": (node) => {
		const props = getComponentProperties(node);
		const { type, alertMessage } = props;
		const { icon, iconClass, bg } = AlertStylesByType[String(type)];

		return {
			type: "htmlelement",
			key: camelCase(alertMessage),
			label: `${type} alert`,
			tag: "div",
			content: `<span class="mr-2 ${iconClass}" data-icon="${icon}"></span>\n<span>\n${alertMessage}\n</span>\n`,
			className: `flex flex-items-start p-40 mt-40 mb-100 ${bg}`,
			tableView: false,
			input: false,
			lockKey: true,
			source: "61b7cba855627e36d98108ca",
			isNew: true,
			attrs: [
				{
					attr: "role",
					value: "alert"
				}
			],
			...getFormioProperties(props)
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
		.reduce((result: FormioOptionValues, node) => {
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
