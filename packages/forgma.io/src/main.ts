import { on, showUI } from "@create-figma-plugin/utilities";

import { ResizeWindowHandler } from "./types";

async function handleAdd()
{
console.log("==== add");
}

export default function()
{
	on<ResizeWindowHandler>(
		"RESIZE_WINDOW",
		function(windowSize: { width: number; height: number }) {
			const { width, height } = windowSize;
			figma.ui.resize(width, height);
		}
	);

	on("add", handleAdd);

	showUI({
		width: 240,
		height: 240
	});
}
