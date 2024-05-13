import { Form } from "@formio/react";
import form from "../form.json";
import { Formio } from "@formio/react";
import { CustomAddress } from "./CustomComponent";

Formio.use(CustomAddress);

export default function App({ listing }) {
	Formio.Utils.listing = listing;

	return (
		<div>
			<h1>{form?.title}</h1>
			<Form
				form={form}
				onSubmit={console.log}
			/>
		</div>
	);
}
