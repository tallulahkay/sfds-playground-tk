import { processSelection, selection } from "./utils/plugin";

const UUIDPattern = /#[\d:]+$/;

type ComponentProcessor = (node: InstanceNode, string: string) => object;

const DefaultProcessor: ComponentProcessor = (node: InstanceNode, type: string) => ({
	type,
	...getComponentProperties(node)
});

const ComponentProcessors: Record<string, ComponentProcessor> = {
	"Checkbox": DefaultProcessor,
	"Text field": DefaultProcessor,
	"Text area": DefaultProcessor,
	"Navigational buttons": (node: InstanceNode, type: string) => ({ type }),
} as const;

function clean(
	key: string)
{
	return key.replace(UUIDPattern, "");
}

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

function convertToFormComponent(
	node: InstanceNode)
{
	const type = getComponentType(node);
	const processor = ComponentProcessors[type];

	if (processor) {
		return processor(node, type);
	}

	return null;
}

export default async function() {
	console.log("==== Dump");
	console.log(selection("INSTANCE"));

//	const names = new Set;
//
//	figma.currentPage.findAllWithCriteria({ types: ["INSTANCE"] }).forEach(node => {
//		names.add(getComponentType(node))
//	});
//	console.log([...names].sort());

	await processSelection("INSTANCE",
		(node) => console.log(convertToFormComponent(node)));
//		(node) => console.log(getComponentType(node)));
//		({ mainComponent }) => console.log(mainComponent?.parent?.name));
//		({ componentProperties }) => console.log(componentProperties));
//	console.log(getSelection().map(getFormComponents));

	figma.closePlugin("dump!!!");
}
