import { FormioOptionValues, isInstance } from "@/types";
import { uniqueKey } from "@/utils/string";
import { getFigmaComponentProperties } from "@/formio/getFigmaComponentProperties";

export function getFormioOptionProperties(
	node: SceneNode)
{
	if (!isInstance(node)) {
		return null;
	}

	return node.children
		.filter(isInstance)
		.filter(({ visible }) => visible)
		.reduce((
			result: FormioOptionValues,
			node) => {
			const { rowText, text, status } = getFigmaComponentProperties(node);
			const label = (rowText || text) as string;
			const value = uniqueKey(label);

			result.values.push({
				label,
				value,
				shortcut: ""
			});
			result.defaultValue[value] = status === "Selected";

			return result;
		}, { values: [], defaultValue: {} });
}
