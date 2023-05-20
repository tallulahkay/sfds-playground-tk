import { isInstance, isNotNull } from "@/types";
import { findChildByName, findChildByPath } from "@/utils/plugin";
import { camelCase } from "@/utils/string";
import { getFormioJSON } from "@/formio/getFormioJSON";

export function getPanelJSON(
	node: FrameNode)
{
	const mainContent = findChildByPath(node, "Content area/Main content") as FrameNode;
	const pageTitle = findChildByName(mainContent, "Page title") as TextNode;

	if (mainContent && pageTitle) {
		const title = pageTitle?.characters;
		const components = mainContent.children.filter(isInstance)
			.map(getFormioJSON)
			.filter(isNotNull);

		return {
			type: "panel",
			title,
			key: camelCase(title),
			label: title,
			breadcrumbClickable: true,
			buttonSettings: {
				previous: true,
				cancel: true,
				next: true
			},
			navigateOnEnter: false,
			saveOnEnter: false,
			scrollToTop: false,
			collapsible: false,
			components
		};
	}

	return null;
}
