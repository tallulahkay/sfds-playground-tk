import { processComponent } from "./processComponent.js";

export function panelGroup(
	data,
	uniqueKey)
{
	const { key, label, panels } = data;
	const groupTag = `grp:${key}`;

	for (const panel of panels) {
		panel.tags = (panel.tags ?? []).concat(groupTag);
	}

	return panels.flatMap((panel) => processComponent(panel, uniqueKey));
}
