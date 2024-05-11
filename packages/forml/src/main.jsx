import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/components/App.jsx";
import "./global.css";
import { listing } from "../listing.json";

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<App listing={listing} />
	</React.StrictMode>,
);
