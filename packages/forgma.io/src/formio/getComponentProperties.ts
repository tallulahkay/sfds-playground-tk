import { FigmaComponentProps } from "@/types";
import { clean } from "@/utils/string";

export function getComponentProperties(
	node: InstanceNode): FigmaComponentProps
{
	const { componentProperties } = node;

	return Object.fromEntries(Object.entries(componentProperties).map(
		([key, value]) => [clean(key), value.value])
	);
}
