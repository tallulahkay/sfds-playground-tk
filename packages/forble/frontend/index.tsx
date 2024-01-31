import React from "react";
import { initializeBlock } from "@airtable/blocks/ui";
import App from "./App";
import "./css/styles.css";
import "./css/sfds-form.css";

initializeBlock(() => <App />);
