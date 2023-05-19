import { ComponentSpec } from "@/types";
import { camelCase } from "@/utils/string";
import { getComponentProperties } from "@/formio/getComponentProperties";
import mailingAddress from "@/formio/mailingAddress.json";

const spec: ComponentSpec = [
	"Fieldset",
	(node) => {
		const props = getComponentProperties(node);
		const json = JSON.parse(JSON.stringify(mailingAddress));

		json.label = props.labelText;
		json.key = camelCase(props.labelText);

		return json;
	}
];

export default spec;
