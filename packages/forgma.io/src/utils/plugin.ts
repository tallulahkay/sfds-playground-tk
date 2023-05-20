import { traverseNode } from "@create-figma-plugin/utilities";

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

export function findChildByName(
	node: FrameNode,
	name: string)
{
	if (node) {
		const { children } = node;

		for (const child of children) {
			if (child.name === name) {
				return child;
			}
		}
	}

	return null;
}

export function findChildByPath(
	node: FrameNode,
	path: string|string[])
{
	let parent = node;
	let child = null;
	let names = path;

	if (typeof path === "string") {
		names = path.split("/");
	}

	for (const name of names) {
		child = findChildByName(parent, name);

		if (child) {
			parent = child as FrameNode;
		} else {
			break;
		}
	}

	return child;
}
