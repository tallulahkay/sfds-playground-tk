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
	const tableID = cursor.activeTableId ?? "";
	const viewID = cursor.activeViewId ?? "";
	const table = base.getTableById(tableID);
	const view = table.getViewById(viewID);
	const records = useRecords(view);
	const fieldNames = getFieldNames(table);
	const formDefinition = { components: [] };
	const uniqueKey = createUniqueKeyFn();

	if (records) {
		formDefinition.components = records.map(record => {
			const { Type, ID, Label, Items, Required = false, Logic } = getCellObject(record, fieldNames);
			const component = {
				type: FormioTypes[Type],
				key: uniqueKey(ID),
				label: Label,
				input: true,
				validate: {
					required: Required
				}
			};

			if (Type === "Select Boxes") {
				component.values = createValues(Items, uniqueKey);
			} else if (Type === "Select") {
				component.dataSrc = "values";
				component.data = {
					values: createValues(Items, uniqueKey)
				};
			} else if (Type === "HTML") {
				component.content = Label;
				component.className = "mb-40";
				delete component.key;
				delete component.input;
				delete component.validate;
			} else if (Type === "Text Area") {
				component.autoExpand = true;
			}

			if (!component.type) {
				return null;
			}

			if (Logic) {
				component.customConditional = Logic;
			}

			return component;
		})
			.filter(o => o);
	}

	return (
		<div className="formio-sfds">
			<Form form={formDefinition} />
		</div>
	);
}
