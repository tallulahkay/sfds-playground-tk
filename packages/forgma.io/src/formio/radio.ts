import { ComponentSpec } from "@/types";
import { uniqueKey } from "@/utils/string";
import { getFormioProperties } from "@/formio/getFormioProperties";
import { getFormioOptionProperties } from "@/formio/getFormioOptionProperties";
import { getFigmaComponentProperties } from "@/formio/getFigmaComponentProperties";

const spec: ComponentSpec = [
	"Radio",
	(node) => {
		const props = getFigmaComponentProperties(node);

		return {
			type: "radio",
			key: uniqueKey(props.labelText),
			tableView: false,
			input: true,
			optionsLabelPosition: "right",
			...getFormioProperties(props),
			...getFormioOptionProperties(node)
		};
	}
];

export default spec;
