import styles from "./Breadcrumbs.module.css";

function getGroupByKey(
	groups,
	key)
{
	for (const group of Object.values(groups)) {
		if (group.panelKeys.includes(key)) {
			return group;
		}
	}

	return null;
}

export default function Breadcrumbs({
	form,
	currentPanelKey })
{
	const { panelGroups = {} } = form?.metadata;
	const currentGroup = getGroupByKey(panelGroups, currentPanelKey);

	return (
		<ul className={styles.breadcrumbs}>
			{Object.values(panelGroups).map(({ key, label }) => (
				<li
					key={key}
					className={key === currentGroup?.key ? styles.current : ""}
				>
					{label}
				</li>
			))}
		</ul>
	);
}
