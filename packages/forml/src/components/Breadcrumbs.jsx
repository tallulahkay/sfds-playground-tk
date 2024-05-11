import { useMemo } from "react";

const GroupPrefix = "grp:";

function getGroupTagByKey(
	groups,
	key)
{
	for (const [tag, keys] of Object.entries(groups)) {
		if (keys.includes(key)) {
			return tag;
		}
	}

	return null;
}

export default function Breadcrumbs({
	form,
	currentPanelKey })
{
		// iterate over the top-level panels, find a tag starting with "grp:", and
		// then group the panel keys by that tag
	const panelKeysByGroup = useMemo(
		() => form.components.reduce((result, { tags, key }) => {
			const groupTag = tags.find(tag => tag.startsWith(GroupPrefix));

			if (groupTag) {
					// remove the prefix
				const tagName = groupTag.slice(GroupPrefix.length);
				const keysInGroup = result[tagName] || (result[tagName] = []);

				keysInGroup.push(key);
			} else {
				console.error(`Missing group tag for panel in panelGroup: ${key}, tags: ${JSON.stringify(tags)}`);
			}

			return result;
		}, {}),
		[form.components]
	);
	const currentGroupTag = getGroupTagByKey(panelKeysByGroup, currentPanelKey);

	return (
		<ul>
			{Object.keys(panelKeysByGroup).map(tagName => (
				<li
					key={tagName}
					style={tagName === currentGroupTag ? { fontWeight: "bold" } : {}}
				>
					<a href={`#${tagName}`}>{tagName}</a>
				</li>
			))}
		</ul>
	);
}
