import { FormioJSON, FormioOptionProps, isNotNull } from "@/types";
import { findChildByName, findChildByPath } from "@/utils/plugin";
import { uniqueKey } from "@/utils/string";
import { getFormioJSON } from "@/formio/getFormioJSON";

	// find the last component that could serve as a source of values in a conditional
const lastSource = (array: any[]) => [...array].reverse().find(({ values }) => values);

function addSource(
	conditional: FormioJSON,
	source: FormioJSON)
{
	if (source.values) {
		const labelPattern = new RegExp(`^${conditional.label}`, "i");
		const option = source.values.find((option: FormioOptionProps) => labelPattern.test(option.label));

		if (option) {
			conditional.when = source.key;
			conditional.value = option.value;
console.log("--- logic", conditional, source);

			return conditional;
		}
	}
console.log("--- MISSING logic", conditional, source);

	return null;
}

function processChildren(
	children: readonly SceneNode[])
{
	const components = [];
	let lastConditional;

	for (const child of children) {
		const component = getFormioJSON(child);

		if (component) {
			if (component.type === "Conditional") {
					// track this conditional, but don't include it in the components
				lastConditional = addSource(component, lastSource(components));
			} else {
				const { paddingLeft } = child as InstanceNode;

				if (paddingLeft && lastConditional) {
					const { when, value, logic } = lastConditional;

					component.conditional = {
						show: true,
						when,
						[logic]: value
					};
console.log("=== conditional", component);
				}

				components.push(component);
			}
		}
	}

	return components;
}

export function getPanelJSON(
	node: FrameNode)
{
	const mainContent = findChildByPath(node, "Content area/Main content") as FrameNode;
	const firstPageContent = findChildByPath(node, "Content area/Main content/Content") as FrameNode;
	const pageTitle = findChildByName(mainContent, "Page title") as TextNode;

	if (mainContent && pageTitle) {
		const title = pageTitle.characters;
		const { children } = (firstPageContent || mainContent);
		const components = processChildren(children);

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
			navigateOnEnter: true,
			saveOnEnter: false,
			scrollToTop: true,
			collapsible: false,
			components
		};
	}

	return null;
}
