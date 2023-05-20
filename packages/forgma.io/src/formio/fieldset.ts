import { ComponentSpec } from "@/types";
import { uniqueKey } from "@/utils/string";
import { getFigmaComponentProperties } from "@/formio/getFigmaComponentProperties";
import mailingAddress from "@/formio/mailingAddress.json";

const spec: ComponentSpec = [
	"Fieldset",
	(node) => {
		const props = getFigmaComponentProperties(node);
		const json = JSON.parse(JSON.stringify(mailingAddress));

		json.label = props.labelText;
		json.key = uniqueKey(props.labelText);

		return json;
	}
];

export default spec;
