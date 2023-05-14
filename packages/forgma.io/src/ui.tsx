import { Button, render, useWindowResize } from "@create-figma-plugin/ui";
import { emit } from "@create-figma-plugin/utilities";
import { h } from "preact";

import { ResizeWindowHandler } from "./types";

function Plugin()
{
	function onWindowResize(windowSize: { width: number; height: number })
	{
		emit<ResizeWindowHandler>("RESIZE_WINDOW", windowSize);
	}

	useWindowResize(onWindowResize, {
		minWidth: 120,
		minHeight: 120,
		maxWidth: 320,
		maxHeight: 320,
		resizeBehaviorOnDoubleClick: "minimize"
	});

	const handleButtonClick = (event: MouseEvent) => {
		const target = event.target as HTMLButtonElement;
console.log("=== handleButtonClick", target);

		if (target?.id) {
			emit(target.id);
		}
	};

	return (
		<div
			onClick={handleButtonClick}
		>
			<Button id="build">Build Form</Button>
		</div>
	);
}

export default render(Plugin);
