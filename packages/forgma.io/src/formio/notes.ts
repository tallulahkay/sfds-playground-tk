import { ComponentSpec } from "@/types";
import { getFigmaComponentProperties } from "@/formio/getFigmaComponentProperties";

const IsPattern = / is\s*$/i;
const OrPattern = /\s*OR\s*/i;

const spec: ComponentSpec = [
	"Notes",
	(node) => {
		const props = getFigmaComponentProperties(node);

		if (props.type !== "Conditional logics") {
			return null;
		}

		const labels = (props.valueText as string).split(OrPattern);

		return {
			type: "Conditional",
			logic: IsPattern.test(props.logic as string)
				? "eq"
				: "neq",
			label: labels.length > 1
				? labels
				: labels[0]
		};
	}
];

export default spec;
