import { ComponentSpec } from "@/types";
import { camelCase } from "@/utils/string";
import { getFormioProperties } from "@/getFormioProperties";
import { getFormioOptionProperties } from "@/formio/getFormioOptionProperties";
import { getComponentProperties } from "@/formio/getComponentProperties";

const spec: ComponentSpec = [
	"Checkbox",
	(node) => {
		const props = getComponentProperties(node);

		return {
			type: "selectboxes",
			key: camelCase(props.labelText),
			tableView: false,
			inputType: "checkbox",
			optionsLabelPosition: "right",
			...getFormioProperties(props),
			...getFormioOptionProperties(node)
		};
	}
];

export default spec;
