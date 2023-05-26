import { FormioJSON, FormioOptionProps, isNotNull } from "@/types";
import { findChildByName, findChildByPath } from "@/utils/plugin";
import { uniqueKey } from "@/utils/string";
import { getFormioJSON } from "@/formio/getFormioJSON";

	// find the last component that could serve as a source of values in a conditional
const lastSource = (array: any[]) => [...array].reverse().find(({ values }) => values);

function addSourceToConditional(
	source: FormioJSON,
	conditional: FormioJSON)
{
	if (source.values) {
		const labelPattern = new RegExp(`^(${conditional.labels.join("|")})`, "i");
		const values = (source.values as FormioOptionProps[])
			.filter(({ label }) => labelPattern.test(label))
			.map(({ value }) => value);

		if (values.length) {
			conditional.when = source.key;
			conditional.values = values;

			return conditional;
		}
	}

console.log("--- MISSING logic", conditional, source);

	return null;
}

function addConditionalToComponent(
	conditional: FormioJSON,
	component: FormioJSON)
{
	const { when, values, operator } = conditional;
	let logic = {};

	if (values.length === 1) {
		logic = {
			show: true,
			when,
			[operator]: values[0]
		};
	} else {
			// OR all the paths to the keys on the object that were included in the conditional
		logic = {
			json: {
				"or": values.map((key: string) => ({ var: `data.${when}.${key}` }))
			}
		};
	}

	component.conditional = logic;
}

function processChildren(
	children: readonly SceneNode[])
{
	const components = [];
	const conditionalsByPadding: Record<number, FormioJSON|null> = {};
	let pendingConditional;

	for (const child of children) {
		const component = getFormioJSON(child);

		if (component) {
			if (component.type === "Conditional") {
					// track this conditional, but don't include it in the components.  we
					// also don't know what padding level to assign it until we see the
					// next component that has a paddingLeft value.
				pendingConditional = addSourceToConditional(lastSource(components), component);
			} else {
				const { paddingLeft } = child as InstanceNode;

				if (paddingLeft) {
						// non-zero paddingLeft indicates that the visiblity of this
						// component is controlled by a conditional
					if (pendingConditional) {
							// there's a conditional waiting to be stored, so assign it to
							// this component's padding level
						conditionalsByPadding[paddingLeft] = pendingConditional;
						pendingConditional = null;
					}

					const conditional = conditionalsByPadding[paddingLeft];

					if (conditional) {
						addConditionalToComponent(conditional, component);
					}
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
