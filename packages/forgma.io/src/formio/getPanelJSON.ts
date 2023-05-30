import { FormioJSON, FormioOptionProps, isNotEmpty } from "@/types";
import { findChildByName, findChildByPath } from "@/utils/plugin";
import { uniqueKey } from "@/utils/string";
import { getFormioJSON } from "@/formio/getFormioJSON";

	// find the last component that could serve as a source of values in a conditional
const lastSource = (array: readonly any[]) => [...array].reverse().find(({ values }) => values);

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
	return children.map(getFormioJSON).filter(isNotEmpty);
}

function processConditionals(
	components: readonly FormioJSON[])
{
	const processed = [];
	const conditionalsByLevel: Record<number, FormioJSON|null> = {};
	let pendingConditional;

	for (const component of components) {
		if (component) {
			if (component.type === "Conditional") {
					// track this conditional, but don't include it in the components.  we
					// also don't know what level to assign it until we see the next
					// component that has a conditionalLevel value.
				pendingConditional = addSourceToConditional(lastSource(processed), component);
			} else {
				const { conditionalLevel } = component;

				if (conditionalLevel) {
						// non-zero paddingLeft indicates that the visiblity of this
						// component is controlled by a conditional
					if (pendingConditional) {
							// there's a conditional waiting to be stored, so assign it to
							// this component's padding level
						conditionalsByLevel[conditionalLevel] = pendingConditional;
						pendingConditional = null;
					}

					const conditional = conditionalsByLevel[conditionalLevel];

					if (conditional) {
						addConditionalToComponent(conditional, component);
					}

						// we no longer need this, and it isn't a Formio prop, so remove it
					delete component.conditionalLevel;
				}

				processed.push(component);
			}
		}
	}

	return processed;
}

export function processPanelConditionals(
	panel: FormioJSON)
{
	const { components } = panel;

		// apply any conditionals in the array to the indented components that
		// follow them
	panel.components = processConditionals(components);

	return panel;
}

export async function getPanelJSON(
	node: FrameNode)
{
	const mainContent = findChildByPath(node, "Content area/Main content") as FrameNode;
	const firstPageContent = findChildByPath(node, "Content area/Main content/Content") as FrameNode;
	const pageTitle = findChildByName(mainContent, "Page title") as TextNode;
	const content = firstPageContent || mainContent;

	if (content && pageTitle) {
		const title = pageTitle.characters;
			// don't include the page title node as a child that gets processed, since
			// we just put its text directly into the title prop of the panel
		const children = content.children.filter(child => child !== pageTitle);
			// convert the child nodes to JSON objects corresponding to Formio components
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
