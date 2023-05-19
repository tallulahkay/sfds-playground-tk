import { ComponentSpec } from "@/types";
import { camelCase } from "@/utils/string";
import { getFormioProperties } from "@/getFormioProperties";
import { getFormioOptionProperties } from "@/formio/getFormioOptionProperties";
import { getComponentProperties } from "@/formio/getComponentProperties";

const spec: ComponentSpec = [
	"Radio",
	(node) => {
		const props = getComponentProperties(node);

		return {
			type: "radio",
			key: camelCase(props.labelText),
			tableView: false,
			input: true,
			optionsLabelPosition: "right",
			...getFormioProperties(props),
			...getFormioOptionProperties(node)
		};
	}
];

export default spec;
