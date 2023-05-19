import { ComponentSpec } from "@/types";
import { camelCase } from "@/utils/string";
import { getFormioProperties } from "@/getFormioProperties";
import { getComponentProperties } from "@/formio/getComponentProperties";

const spec: ComponentSpec = [
	"Upload",
	(node) => {
		const props = getComponentProperties(node);

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
