import { ComponentSpec } from "@/types";
import { camelCase } from "@/utils/string";
import { getFormioProperties } from "@/getFormioProperties";
import { getComponentProperties } from "@/formio/getComponentProperties";

const spec: ComponentSpec = [
	"Text area",
	(node) => {
		const props = getComponentProperties(node);

		return {
			type: "textarea",
			key: camelCase(props.labelText),
			autoExpand: false,
			tableView: true,
			input: true,
			...getFormioProperties(props)
		};
	}
];

export default spec;
