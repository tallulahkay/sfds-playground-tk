import { ComponentProcessor } from "./types";
import { camelCase } from "./utils/string";
import { findChildByName, findChildByPath, isInstance } from "./utils/plugin";
import AlertCallout from "@/formio/alertCallout";
import Checkbox from "@/formio/checkbox";
import CheckboxText from "@/formio/checkboxText";
import Fieldset from "@/formio/fieldset";
import Radio from "@/formio/radio";
import TextArea from "@/formio/textArea";
import TextField from "@/formio/textField";
import Upload from "@/formio/upload";

const ComponentProcessors: Record<string, ComponentProcessor> = Object.fromEntries([
	AlertCallout,
	Checkbox,
	CheckboxText,
	Fieldset,
	Radio,
	TextArea,
	TextField,
	Upload
]);

function getComponentType(
	node: InstanceNode)
{
	const { mainComponent } = node;
	let type = "UNKNOWN";

	if (mainComponent) {
		if (mainComponent.parent) {
			type = mainComponent.parent.name;
		} else {
			type = mainComponent.name;
		}
	}

	return type;
}

export function getFormioJSON(
	node: InstanceNode)
{
	const type = getComponentType(node);
	const processor = ComponentProcessors[type];

	if (processor) {
		return processor(node);
	}

	return null;
}

export function getPanelJSON(
	node: FrameNode)
{
	const mainContent = findChildByPath(node, "Content area/Main content") as FrameNode;
	const pageTitle = findChildByName(mainContent, "Page title") as TextNode;
	const title = pageTitle?.characters;
	const components = mainContent.children.filter(isInstance)
		.map(getFormioJSON)
//		.filter((node) => node);

	return {
		type: "panel",
		title,
		key: camelCase(title),
		label: title,
		breadcrumbClickable: true,
		buttonSettings: {
			previous: true,
			cancel: true,
			next: true
		},
		navigateOnEnter: false,
		saveOnEnter: false,
		scrollToTop: false,
		collapsible: false,
		components
	};
}
