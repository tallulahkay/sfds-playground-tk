import { ComponentSpec } from "@/types";
import { uniqueKey } from "@/utils/string";
import { getFormioProperties } from "@/formio/getFormioProperties";
import { getFigmaComponentProperties } from "@/formio/getFigmaComponentProperties";

const spec: ComponentSpec = [
	"Checkbox text",
	(node) => {
		const props = getFigmaComponentProperties(node);

		return {
			type: "checkbox",
			key: uniqueKey(props.checkboxText),
			tableView: false,
			input: true,
			defaultValue: props.type === "Selected",
			...getFormioProperties(props)
		};
	}
];

export default spec;
