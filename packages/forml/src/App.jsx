import { Form } from "@formio/react";
import formData from "./form.yaml";
import { generateForm } from "./form/generateForm.js";

export default function App()
{
	const form = generateForm(formData);

	return (
		<div>
			<h1>{form.title}</h1>
			<Form form={form} />
		</div>
	);
}
