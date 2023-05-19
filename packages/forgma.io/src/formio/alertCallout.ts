import { ComponentSpec } from "@/types";
import { camelCase } from "@/utils/string";
import { getFormioProperties } from "@/formio/getFormioProperties";
import { getComponentProperties } from "@/formio/getComponentProperties";

const AlertStylesByType: Record<string, { icon: string, iconClass: string, bg: string }> = {
	Informational: {
		icon: "alert",
		iconClass: "",
		bg: "bg-blue-1"
	},
	Success: {
		icon: "alert",
		iconClass: "",
		bg: "bg-blue-1"
	},
	Failure: {
		icon: "delete",
		iconClass: "fg-red-4",
		bg: "bg-red-1"
	}
} as const;

const spec: ComponentSpec = [
	"Alert callouts",
	(node) => {
		const props = getComponentProperties(node);
		const { type, alertMessage } = props;
		const { icon, iconClass, bg } = AlertStylesByType[String(type)];

		return {
			type: "htmlelement",
			key: camelCase(alertMessage),
			label: `${type} alert`,
			tag: "div",
			content: `<span class="mr-2 ${iconClass}" data-icon="${icon}"></span>\n<span>\n${alertMessage}\n</span>\n`,
			className: `flex flex-items-start p-40 mt-40 mb-100 ${bg}`,
			tableView: false,
			input: false,
			lockKey: true,
			source: "61b7cba855627e36d98108ca",
			isNew: true,
			attrs: [
				{
					attr: "role",
					value: "alert"
				}
			],
			...getFormioProperties(props)
		};
	}
];

export default spec;
