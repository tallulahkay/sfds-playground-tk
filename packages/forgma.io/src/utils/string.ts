const CamelPattern = /^\w|[A-Z]|\b\w/g;
const IllegalCamelPattern = /[\s\W]+/g;
const UUIDPattern = /#[\d:]+$/;

function adjustCase(
	word: string,
	index: number)
{
	return index === 0 ? word.toLowerCase() : word.toUpperCase();
}

export function camelCase(
	value: any)
{
	return String(value)
		.replace(CamelPattern, adjustCase)
		.replace(IllegalCamelPattern, "");
}

export function clean(
	key: string)
{
	return camelCase(key.replace(UUIDPattern, ""));
}
