import {
	ComponentProcessor,
	isFrame,
	isInstance,
	isNotEmpty,
	isText
} from "@/types";
import AlertCallout from "@/formio/alertCallout";
import Checkbox from "@/formio/checkbox";
import CheckboxText from "@/formio/checkboxText";
import Fieldset from "@/formio/fieldset";
import Notes from "@/formio/notes";
import PlainText from "@/formio/plainText";
import Radio from "@/formio/radio";
import TextArea from "@/formio/textArea";
import TextField from "@/formio/textField";
import TextNode from "@/formio/textNode";
import Upload from "@/formio/upload";

const ComponentProcessors: Record<string, ComponentProcessor> = Object.fromEntries([
	AlertCallout,
	Checkbox,
	CheckboxText,
	Fieldset,
	Notes,
	PlainText,
	Radio,
	TextArea,
	TextField,
	TextNode,
	Upload
]);

function getComponentType(
	node: SceneNode)
{
	let type: string = node.type;

	if (isInstance(node)) {
		const { mainComponent } = node;

		if (mainComponent) {
			if (mainComponent.parent) {
				type = mainComponent.parent.name;
			} else {
				type = mainComponent.name;
			}
		}
	} else if (isFrame(node)) {
		type = node.name;
	}

	return type;
}

export function getFormioJSON(
	node: SceneNode)
{
	const type = getComponentType(node);
	const processor = ComponentProcessors[type];

	if (processor && (isInstance(node) || isText(node))) {
		const json = processor(node);

		if (json && json.type !== "Conditional" && isInstance(node) && node.paddingLeft) {
				// we need to temporarily store the paddingLeft on the component so we
				// know which components are affected by which conditional
			json.conditionalLevel = node.paddingLeft;
		}

		return json;
	}

	return null;
}
