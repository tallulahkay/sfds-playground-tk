import { processComponent } from "./processComponent.js";

export function panelGroup(
	data,
	context)
{
	const { key, label, panels } = data;
	const { metadata } = context;
	const panelGroups = metadata.panelGroups || (metadata.panelGroups = {});
	const groupInfo = panelGroups[key] ||
		(panelGroups[key] = { key, label, panelKeys: [] });
	const processedPanels = panels.flatMap((panel) => processComponent(panel, context));

	for (const panel of processedPanels) {
			// add all the child panel keys to the group info so the Breadcrumbs
			// component can determine which group the form is currently in
		groupInfo.panelKeys.push(panel.key);
		panel.tags = (panel.tags ?? []).concat(`grp:${key}`);
	}

	return processedPanels;
}
