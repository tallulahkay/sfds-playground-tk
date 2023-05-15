const CamelPattern = /^\w|[A-Z]|\b\w/g;
const CamelSplitPattern = /([a-z\d])([A-Z])/g;
const IllegalCamelPattern = /[\s\W]+/g;
const UUIDPattern = /#[\d:]+$/;

function adjustCase(
	word: string,
	index: number)
{
	return index === 0 ? word.toLowerCase() : word.toUpperCase();
}

export function camelCase(
	value: any,
	maxLength = 32)
{
	let result = String(value)
		.replace(CamelPattern, adjustCase)
		.replace(IllegalCamelPattern, "");

	if (maxLength && result.length > maxLength) {
		let length = 0;

			// split the camelCased string between lower and uppercase letters, then
			// keep adding those words until the length > maxLength
		result = result
			.replace(CamelSplitPattern, "$1 $2")
			.split(" ")
			.filter((word) => {
				length += word.length;

				return length <= maxLength;
			})
			.join("");
	}

	return result;
}

export function clean(
	key: string)
{
	return camelCase(key.replace(UUIDPattern, ""));
}
