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

const FormioTypes = {
	"Text Field": "textfield",
	"Number": "number",
	"Email": "email",
	"Phone Number": "phoneNumber",
};

export default function App()
{
	const base = useBase();
	const cursor = useCursor();
	const tableID = cursor.activeTableId ?? "";
	const viewID = cursor.activeViewId ?? "";
	const table = base.getTableById(tableID);
	const view = table.getViewById(viewID);
	const records = useRecords(view);
	const formDefinition = { components: [] };

	if (records) {
		formDefinition.components = records.map(record => ({
			type: FormioTypes[record.getCellValueAsString("Type")],
			key: record.getCellValueAsString("ID"),
			label: record.getCellValueAsString("Label"),
			input: true,
		}));
	}

	return (
		<div className="formio-sfds">
			<Form form={formDefinition} />
		</div>
	);
}
