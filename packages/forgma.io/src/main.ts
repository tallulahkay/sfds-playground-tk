import { FormioJSON, isFrame, isNotNull } from "@/types";
import { selection } from "@/utils/plugin";
import { getPanelJSON } from "@/formio/getPanelJSON";
import { formioToken } from "../.env.json";

const FormioURL = "http://127.0.0.1:3000/api/create";
const FormTag = "FORGMA";

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
		const { title: panelTitle, key } = firstPanel;
		const title = `${FormTag} ${panelTitle}`;
		const name = FormTag + key;
		const path = name.toLowerCase();

		return {
			type: "form",
			display: "wizard",
			title,
			name,
			path,
			tags: [FormTag],
			components: panels
		};
	}

	return null;
}

export default async function() {
	const [selectedItem] = selection("GROUP");
	let exitMessage = "Make sure a group of panels is selected.";

	if (selectedItem?.children[0].type === "FRAME") {
		figma.notify("Converting Figma design...", { timeout: 500 });

		const form = getFormJSON(selectedItem.children[0]);

		if (form) {
			figma.notify("Creating form...", { timeout: 500 });

			try {
				const response = await createForm(form);
				const responseJSON = await response.json();

				console.log("response", response, responseJSON);

				if (response.ok) {
					exitMessage = `Form created: ${form.name}`;
				} else {
					exitMessage = `ERROR: ${responseJSON.message}`;
				}
			} catch (e) {
				console.error(e);
				exitMessage = `ERROR: ${(e as Error).message}`;
			}

			console.log("FORM", form);
		}
	}

	figma.closePlugin(exitMessage);
}
