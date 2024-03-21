import { createUniqueKeyFn } from "./string.js";
import { processComponent } from "./processComponent.js";
import { listing } from "./listing.json";

export function generateForm(
	data)
{
	const uniqueKey = createUniqueKeyFn();
	const form = processComponent(data, uniqueKey);

	delete form.aliases;

		// this is a bit of a kludge, but provide the listing data to the blocks of
		// component logic via the utils var
	Formio.Utils.listing = listing;

	return form;
}
