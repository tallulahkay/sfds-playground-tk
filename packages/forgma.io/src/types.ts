export type FormioJSON = Record<string, any>;
export type FigmaComponentProps = Record<string, string|boolean>;
export type ComponentProcessor = (node: InstanceNode|TextNode) => FormioJSON|null;
export type ComponentSpec = [string, ComponentProcessor];

export type FormioOptionProps = {
	label: string,
	value: string,
	shortcut: string
};

export type FormioOptionValues = {
	values: FormioOptionProps[],
	defaultValue: Record<string, boolean>
};

export function isInstance(
	node: SceneNode): node is InstanceNode
{
	return node.type === "INSTANCE";
}

export function isFrame(
	node: SceneNode): node is FrameNode
{
	return node.type === "FRAME";
}

export function isText(
	node: SceneNode): node is TextNode
{
	return node.type === "TEXT";
}

export function isNotEmpty<T>(
	value: T|null|undefined): value is T
{
	return value !== null && value !== undefined;
}
