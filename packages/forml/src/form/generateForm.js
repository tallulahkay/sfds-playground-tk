import { createUniqueKeyFn } from "./string.js";
import { processComponent } from "./processComponent.js";

export function generateForm(
	data)
{
	const uniqueKey = createUniqueKeyFn();
		// pass some context down to each recursion of processComponent so it can
		// add some metadata for things like panelGroups
	const context = {
		uniqueKey,
		metadata: {}
	};
	const form = processComponent(data, context);

	form.metadata = context.metadata;
	delete form.aliases;

	return form;
}
