import { createUniqueKeyFn } from "./string.js";
import { processComponent } from "./processComponent.js";

export function generateForm(
	data)
{
	const uniqueKey = createUniqueKeyFn();

	return processComponent(data, uniqueKey);
}
