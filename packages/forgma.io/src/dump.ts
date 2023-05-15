import { processSelection, selection } from "./utils/plugin";
import { getFormioJSON } from "./getFormioJSON";

export default async function() {
	console.log("==== Dump");
	console.log(selection("INSTANCE"));

//	const names = new Set;
//
//	figma.currentPage.findAllWithCriteria({ types: ["INSTANCE"] }).forEach(node => {
//		names.add(getComponentType(node))
//	});
//	console.log([...names].sort());

	await processSelection("INSTANCE",
		(node) => console.log(JSON.stringify(getFormioJSON(node), null, "\t")));
//		(node) => console.log(getFormioJSON(node)));
//		(node) => console.log(getComponentType(node)));
//		({ mainComponent }) => console.log(mainComponent?.parent?.name));
//		({ componentProperties }) => console.log(componentProperties));
//	console.log(getSelection().map(getFormComponents));

	figma.closePlugin("dump!!!");
}
