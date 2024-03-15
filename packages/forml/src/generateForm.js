import { createUniqueKeyFn } from "./string.js";
import { processComponent } from "./components/index.js";

export function generateForm(
	data)
{
	const uniqueKey = createUniqueKeyFn();

	return processComponent(data, uniqueKey);
}
