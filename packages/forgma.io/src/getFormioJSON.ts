import { camelCase, clean } from "./utils/string";
import { FigmaComponentProps, JSON } from "./types";
import { mapProperties } from "./mapProperties";

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
	"Text area": (node: InstanceNode, type: string) => {
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
