import { Form } from "@formio/react";
import { generateForm } from "./form/generateForm.js";
import formData from "../form.yaml";

let form;
let errorMessage;

try {
	form = generateForm(formData);
} catch (e) {
	errorMessage = e.message;
}

console.log(form);

export default function App({
	listing })
{
		// this is a bit of a kludge, but provide the listing data to the blocks of
		// component logic via the Formio.Utils var
	Formio.Utils.listing = listing;

	return (
		<div>
			<h1>{form?.title}</h1>
			<Form
				form={form}
				onSubmit={console.log}
			/>
			{errorMessage &&
				<p className="alert-warning">{errorMessage}</p>
			}
		</div>
	);
}
