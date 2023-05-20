import { FormioJSON, isFrame, isNotNull } from "@/types";
import { selection } from "@/utils/plugin";
import { getPanelJSON } from "@/formio/getPanelJSON";
import { formioToken } from "../.env.json";

const FormioURL = "https://formio.sfgov.org/dev-ruehbbakcoznmcf";

function createForm(
	form: FormioJSON)
{
	const body = JSON.stringify(form);

	return fetch(FormioURL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-token": formioToken,
		},
		body
	});
}

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
			title: `TEST ${title}`,
			name: `TEST${key}`,
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
		figma.notify("Converting Figma design...");

		const form = getFormJSON(selectedItem.children[0]);

		if (form) {
			figma.notify("Creating form...");

			try {
				const response = await createForm(form);

				console.log("response", response);
				exitMessage = `Form created: ${form.name}`;
			} catch (e) {
				console.error(e);
			}

			console.log("FORM", form);
		}
	}

	figma.closePlugin(exitMessage);
}
