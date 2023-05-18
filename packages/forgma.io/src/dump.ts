import { selection } from "./utils/plugin";
import { getPanelJSON } from "./getFormioJSON";

export default async function() {
	const [selectedItem] = selection("FRAME");

	if (selectedItem) {
		console.log(JSON.stringify(getPanelJSON(selectedItem), null, "\t"));
	}

	figma.closePlugin("dump!!!");
}
