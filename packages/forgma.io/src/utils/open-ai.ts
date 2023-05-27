import { FormioJSON } from "@/types";

const GenerateKeysURL = "http://127.0.0.1:3000/api/generateKeys";

export async function generateKeys(
	components: FormioJSON[]): Promise<FormioJSON[]>
{
	const body = JSON.stringify(components);
	const response = await fetch(GenerateKeysURL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body
	});

	return (await response.json()).result;
}
