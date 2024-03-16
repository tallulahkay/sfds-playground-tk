import { Form } from "@formio/react";
import { generateForm } from "./form/generateForm.js";
import formData from "./form.yaml";

const form = generateForm(formData);

console.log(form);

export default function App()
{
	return (
		<div>
			<h1>{form.title}</h1>
			<Form form={form} />
		</div>
	);
}
