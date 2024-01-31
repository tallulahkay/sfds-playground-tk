import { Table } from "@airtable/blocks/models";

export function getCell(
	record: Record<any, any>,
	fieldNames: string[] | string)
{
	const names = ([] as string[]).concat(fieldNames);
	const result = names.map((name) => {
		let value = record.getCellValue(name);

		if (value && typeof value === "object") {
			value = record.getCellValueAsString(name);
		}

		return value;
	});

	return result.length > 1
		? result
		: result[0];
}

export function getCellObject(
	record: Record<any, any>,
	fieldNames: string[] | string)
{
	const result = [].concat(getCell(record, fieldNames));

	return Object.fromEntries([
		["_id", record.id],
		...result.map((value, i) => [fieldNames[i], value])
	]);
}

export function getFieldNames(
	table: Table,
	filterPattern?: RegExp)
{
	let names = table.fields.map(({ name }) => name);

	if (filterPattern instanceof RegExp) {
		names = names.filter((name) => filterPattern.test(name));
	}

	return names;
}
