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

//const formDefinition = {
//	components: [
//		{
//			type: "textfield",
//			label: "First Name",
//			key: "firstName",
//			input: true,
//		},
//	]
//};

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

	const tableId = cursor.activeTableId ?? "";
	const viewID = cursor.activeViewId ?? "";
	// Read the user's choice for which table and view to use from globalConfig.
//	const globalConfig = useGlobalConfig();
//	const tableId = globalConfig.get("selectedTableId");
//	const viewId = globalConfig.get("selectedViewId");
//	const doneFieldId = globalConfig.get("selectedDoneFieldId");
	const table = base.getTableById(tableId);
	const view = table.getViewById(viewID);
	const records = useRecords(view);
//	const records = useRecords(table);
	const formDefinition = { components: [] };
	let cards = null;

	if (records) {
		cards = records.map(record => <RecordCard key={record.id} record={record} />);
		formDefinition.components = records.map(record => ({
			type: FormioTypes[record.getCellValueAsString("Type")],
			key: record.getCellValueAsString("ID"),
			label: record.getCellValueAsString("Label"),
			input: true,
		}));
	}

//	const cards = records
//		? records.map(record => <RecordCard key={record.id} record={record} />)
//		: null;

	return (
		<div>
			{cards}
			<Form form={formDefinition} />
		</div>
	);
}
