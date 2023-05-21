import { isNotNull } from "@/types";
import { findChildByName, findChildByPath } from "@/utils/plugin";
import { uniqueKey } from "@/utils/string";
import { getFormioJSON } from "@/formio/getFormioJSON";

export function getPanelJSON(
	node: FrameNode)
{
	const mainContent = findChildByPath(node, "Content area/Main content") as FrameNode;
	const firstPageContent = findChildByPath(node, "Content area/Main content/Content") as FrameNode;
	const pageTitle = findChildByName(mainContent, "Page title") as TextNode;

	if (mainContent && pageTitle) {
		const title = pageTitle.characters;
		const { children } = (firstPageContent || mainContent);
		const components = children.map(getFormioJSON)
			.filter(isNotNull);

		return {
			type: "panel",
			title,
			key: uniqueKey(title),
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
