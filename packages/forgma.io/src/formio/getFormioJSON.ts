import { ComponentProcessor } from "@/types";
import AlertCallout from "@/formio/alertCallout";
import Checkbox from "@/formio/checkbox";
import CheckboxText from "@/formio/checkboxText";
import Fieldset from "@/formio/fieldset";
import PlainText from "@/formio/plainText";
import Radio from "@/formio/radio";
import TextArea from "@/formio/textArea";
import TextField from "@/formio/textField";
import Upload from "@/formio/upload";

const ComponentProcessors: Record<string, ComponentProcessor> = Object.fromEntries([
	AlertCallout,
	Checkbox,
	CheckboxText,
	Fieldset,
	PlainText,
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
