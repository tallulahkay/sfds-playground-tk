import { ComponentSpec } from "@/types";
import { uniqueKey } from "@/utils/string";
import { getFormioProperties } from "@/formio/getFormioProperties";
import { getFigmaComponentProperties } from "@/formio/getFigmaComponentProperties";

const spec: ComponentSpec = [
	"Text area",
	(node) => {
		const props = getFigmaComponentProperties(node);

		return {
			type: "textarea",
			key: uniqueKey(props.labelText),
			autoExpand: false,
			tableView: true,
			input: true,
			...getFormioProperties(props)
		};
	}
];

export default spec;
