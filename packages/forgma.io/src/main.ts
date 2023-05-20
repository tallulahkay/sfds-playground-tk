import { selection } from "./utils/plugin";
import { getPanelJSON } from "@/formio/getPanelJSON";
import { isFrame, isNotNull } from "@/types";

function getFormJSON(
	node: FrameNode)
{
	const panels = node.children.filter(isFrame)
		.map(getPanelJSON)
		.filter(isNotNull);
	const [firstPanel] = panels;

	if (firstPanel) {
		const { title, key } = firstPanel;
		const path = key.toLowerCase();

		return {
			type: "form",
			display: "wizard",
			title,
			name: key,
			path,
			components: panels
		};
	}

	return null;
}

export default async function() {
	const [selectedItem] = selection("GROUP");
	let exitMessage = "Make sure a group of panels is selected.";

	if (selectedItem?.children[0].type === "FRAME") {
		figma.notify("Generating form...");

		const form = getFormJSON(selectedItem.children[0]);

		if (form) {
			exitMessage = `Form created: ${form.name}`;

			console.log("FORM", form);
		}
	}

	figma.closePlugin(exitMessage);
}
