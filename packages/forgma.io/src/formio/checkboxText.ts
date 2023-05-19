import { ComponentSpec } from "@/types";
import { camelCase } from "@/utils/string";
import { getFormioProperties } from "@/formio/getFormioProperties";
import { getComponentProperties } from "@/formio/getComponentProperties";

const spec: ComponentSpec = [
	"Checkbox text",
	(node) => {
		const props = getComponentProperties(node);

		return {
			type: "checkbox",
			key: camelCase(props.checkboxText),
			tableView: false,
			input: true,
			defaultValue: props.type === "Selected",
			...getFormioProperties(props)
		};
	}
];

export default spec;
