import { createUniqueKeyFn } from "./string.js";
import { processComponent } from "./processComponent.js";

export function generateForm(
	data)
{
	const uniqueKey = createUniqueKeyFn();
	const form = processComponent(data, uniqueKey);

	delete form.aliases;

	return form;
}
