import {traverseNode} from "@create-figma-plugin/utilities";

export function main(
	func: Function
): Promise<void>
{
	return func()
		.catch(console.error)
		.finally(figma.closePlugin);
}


// TODO: findAllWithCriteria() already does this
export function selection<T extends NodeType>(
	filterType?: T
): Array<{ type: T } & SceneNode>
{
	let result = [...figma.currentPage.selection] as Array<{ type: T } & SceneNode>;

	if (filterType) {
		result = result.filter(({type}) => type === filterType);
	}

	return result;
}


export async function processSelection<T extends NodeType>(
	filterType: T,
	func: (node: { type: T } & SceneNode) => void
): Promise<void>
{
	for (const node of selection(filterType)) {
		await func(node);
	}
}


export function findInGroups<T extends NodeType, N extends { type: T } & SceneNode>(
	filterType: T,
	filterFunc?: (node: SceneNode) => boolean
): Array<N>
{
	let result: SceneNode[] = [];

	figma.currentPage.selection.forEach((node) => {
		traverseNode(node, (node) => {
			if (node.type === filterType && (!filterFunc || filterFunc(node))) {
				result.push(node);
			}
		})
	});

	return result as Array<N>;
}


export function isInstance(
	node: SceneNode): node is InstanceNode
{
	return node.type === "INSTANCE";
}
