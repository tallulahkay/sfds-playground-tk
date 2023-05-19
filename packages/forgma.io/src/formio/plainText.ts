import { ComponentSpec } from "@/types";
import { camelCase } from "@/utils/string";
import { getFormioProperties } from "@/formio/getFormioProperties";
import { getComponentProperties } from "@/formio/getComponentProperties";

const spec: ComponentSpec = [
	"Plain text",
	(node) => {
		const props = getComponentProperties(node);
		const { plainText } = props;

		return {
			type: "htmlelement",
			key: camelCase(plainText),
			label: "html",
			tag: "div",
			content: `<div style="white-space: pre-wrap;">${plainText}</div>`,
			className: "mb-40",
			tableView: false,
			input: false,
			attrs: [
				{
					attr: "",
					value: ""
				}
			],
			...getFormioProperties(props)
		};
	}
];

export default spec;
