import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/components/App.jsx";
import { generateForm } from "@/form/generateForm.js";
import formData from "../form.yaml";
import { listing } from "../listing.json";
import "./global.css";

let form;
let errorMessage;

try {
	form = generateForm(formData);
} catch (e) {
	errorMessage = e.message;
}

console.log(form);

	// this is a bit of a kludge, but provide the listing data to the blocks of
	// component logic via the Formio.Utils var.  ignore any IDE warnings about
	// importing the Formio module.  this global has already been created by this
	// point, and we want to add the listing to it.
Formio.Utils.listing = listing;

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		{errorMessage
			? <p className="alert-warning">{errorMessage}</p>
			: <App
					form={form}
					listingName={listing.Name}
				/>
		}
	</React.StrictMode>,
);
