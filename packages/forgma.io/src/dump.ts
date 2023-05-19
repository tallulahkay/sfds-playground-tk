import { selection } from "./utils/plugin";
import { getFormioJSON, getPanelJSON } from "./getFormioJSON";

export default async function() {
//	const [selectedItem] = selection("INSTANCE");
//
//	if (selectedItem) {
//		console.log(JSON.stringify(getFormioJSON(selectedItem), null, "\t"));
//	}

	const [selectedItem] = selection("FRAME");

	if (selectedItem) {
		console.log(JSON.stringify(getPanelJSON(selectedItem), null, "\t"));
	}

	figma.closePlugin("dump!!!");
}
