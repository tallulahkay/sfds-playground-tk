import { FormioJSON, isFrame, isNotEmpty } from "@/types";
import { selection } from "@/utils/plugin";
import { getPanelJSON, processPanelConditionals } from "@/formio/getPanelJSON";
import { generateKeys } from "@/utils/open-ai";

const CreateFormURL = "http://127.0.0.1:3000/api/create";
const FormTag = "FORGMA";

function createForm(
	form: FormioJSON)
{
	const body = JSON.stringify(form);

	return fetch(CreateFormURL, {
		method: "POST",
		body
	});
}

async function getFormJSON(
	node: FrameNode)
{
		// getPanelJSON returns a promise, since it calls the OpenAI API, so wait for
		// all the promises to settle before filtering out any nulls
	const panels = (await Promise.all(node.children.filter(isFrame).map(getPanelJSON)))
		.filter(isNotEmpty);
	const [firstPanel] = panels;

	if (firstPanel) {
		const { title: panelTitle, key } = firstPanel;
		const title = `${FormTag} ${panelTitle}`;
		const name = FormTag + key;
		const path = name.toLowerCase();
		let components: FormioJSON[] = panels;

		try {
			console.log("==== panels before gpt", panels);
			figma.notify("Talking to our robot overlords...", { timeout: 10000 });

			const result = await generateKeys(components);

			console.log("==== panels after gpt", result);

			if (result) {
					// only update the components if we got something back from the server
				components = result;
			}
		} catch (e) {
			console.error(e);
		}

		components = components.map(processPanelConditionals);

		return {
			type: "form",
			display: "wizard",
			title,
			name,
			path,
			tags: [FormTag],
			components
		};
	}

	return null;
}

export default async function() {
	const [selectedItem] = selection("GROUP");
	let exitMessage = "Make sure a group of panels is selected.";

	if (selectedItem?.children[0].type === "FRAME") {
		figma.notify("Converting Figma design...", { timeout: 500 });

		const form = await getFormJSON(selectedItem.children[0]);

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
