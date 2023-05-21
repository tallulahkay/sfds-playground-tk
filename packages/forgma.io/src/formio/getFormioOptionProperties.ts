import { isInstance } from "@/types";
import { uniqueKey } from "@/utils/string";
import { getFigmaComponentProperties } from "@/formio/getFigmaComponentProperties";

type FormioOptionProps = {
	label: string,
	value: string,
	shortcut: string
};

type FormioOptionValues = {
	values: FormioOptionProps[],
	defaultValue: Record<string, boolean>
};

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
