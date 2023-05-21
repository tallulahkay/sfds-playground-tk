import { EventHandler } from "@create-figma-plugin/utilities";

export interface ResizeWindowHandler extends EventHandler {
	name: "RESIZE_WINDOW";
	handler: (windowSize: { width: number; height: number }) => void;
}

export type FormioJSON = Record<string, any>;
export type FigmaComponentProps = Record<string, string | boolean>;
export type ComponentProcessor = (node: InstanceNode|TextNode) => object;
export type ComponentSpec = [string, ComponentProcessor];

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

export function isNotNull(
	value: any)
{
	return value !== null && value !== undefined;
}
