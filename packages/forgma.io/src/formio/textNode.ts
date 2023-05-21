import { ComponentSpec } from "@/types";
import { uniqueKey } from "@/utils/string";

const spec: ComponentSpec = [
	"TEXT",
	(node ) => {
		const plainText = (node as TextNode).characters;

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
		};
	}
];

export default spec;
