import { ComponentSpec } from "@/types";
import { uniqueKey } from "@/utils/string";
import { getFormioProperties } from "@/formio/getFormioProperties";
import { getFigmaComponentProperties } from "@/formio/getFigmaComponentProperties";

const spec: ComponentSpec = [
	"Plain text",
	(node) => {
		const props = getFigmaComponentProperties(node);
		const { plainText } = props;

		return {
			type: "htmlelement",
			key: uniqueKey(plainText),
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
