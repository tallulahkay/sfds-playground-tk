import React, { useState } from "react";
import {
	useBase,
	useCursor,
	useRecords,
	useGlobalConfig,
	expandRecord,
	TablePickerSynced,
	ViewPickerSynced,
	FieldPickerSynced,
	FormField,
	Input,
	Button,
	Box,
	Icon,
	RecordCard
} from "@airtable/blocks/ui";
import { FieldType } from "@airtable/blocks/models";
import { Form } from "@formio/react";
import { getCellObject, getFieldNames } from "./utils/airtable";
import { createUniqueKeyFn } from "./utils/unique";
import mailingAddress from "./formio/mailingAddress";

const FormioTypes = {
	"Text Field": "textfield",
	"Text Area": "textarea",
	"Number": "number",
	"Email": "email",
	"Phone Number": "phoneNumber",
	"Select Boxes": "selectboxes",
	"Select": "select",
	"Checkbox": "checkbox",
	"HTML": "htmlelement",
	"Mailing Address": "mailingAddress",
} as const;

function createValues(
	labels: string,
	uniqueKey: (s: string) => string)
{
	return (labels ?? "").split("\n")
		.map((label) => label.trim())
		.filter((label) => label)
		.map((label) => ({
			label,
			value: uniqueKey(label)
		}));
}

export default function App()
{
	const base = useBase();
	const cursor = useCursor();
	const tableID = cursor?.activeTableId ?? "";
	const viewID = cursor?.activeViewId ?? "";
	const table = base.getTableByIdIfExists(tableID);
	const view = table.getViewByIdIfExists(viewID);
	const records = useRecords(view);
	const fieldNames = getFieldNames(table);
	const formDefinition = { components: [] };
	const uniqueKey = createUniqueKeyFn();

	if (records) {
		formDefinition.components = records.map(record => {
			const { Type, ID, Label, Items, Required = false, Logic } = getCellObject(record, fieldNames);
			const type = FormioTypes[Type];
			let component = {
				type,
				key: uniqueKey(ID),
				label: Label,
				input: true,
				validate: {
					required: Required
				}
			};

			if (!type) {
				return null;
			}

			switch (Type) {
				case "Select Boxes":
					component.values = createValues(Items, uniqueKey);
					break;

				case "Select":
					component.dataSrc = "values";
					component.data = {
						values: createValues(Items, uniqueKey)
					};
					break;

				case "HTML":
					component.content = Label;
					component.className = "mb-40";
					delete component.key;
					delete component.input;
					delete component.validate;
					break;

				case "Text Area":
					component.autoExpand = true;
					break;

				case "Mailing Address":
					component = mailingAddress(ID, Label, uniqueKey);
					break;
			}

			if (Logic) {
				component.customConditional = Logic;
			}

			return component;
		})
			.filter(Boolean);
	}

	return (
		<div className="formio-sfds">
			<Form form={formDefinition} />
		</div>
	);
}
