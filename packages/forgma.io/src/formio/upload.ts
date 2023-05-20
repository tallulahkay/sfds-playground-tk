import { ComponentSpec } from "@/types";
import { camelCase } from "@/utils/string";
import { getFormioProperties } from "@/formio/getFormioProperties";
import { getFigmaComponentProperties } from "@/formio/getFigmaComponentProperties";

const spec: ComponentSpec = [
	"Upload",
	(node) => {
		const props = getFigmaComponentProperties(node);

		return {
			type: "file",
			key: camelCase(props.labelText),
			tableView: false,
			input: true,
			storage: "azure",
			dir: "ooc-equity-mvp",
			webcam: true,
			fileTypes: [
				{
					label: "",
					value: ""
				}
			],
			...getFormioProperties(props)
		};
	}
];

export default spec;
