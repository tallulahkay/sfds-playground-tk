import { FigmaComponentProps, FormioJSON } from "./types";
import { camelCase, clean } from "./utils/string";
import { findChildByName, findChildByPath, isInstance } from "./utils/plugin";
import { getFormioProperties } from "./getFormioProperties";
import mailingAddress from "./mailingAddress.json";

const AlertStylesByType: Record<string, { icon: string, iconClass: string, bg: string }> = {
	Informational: {
		icon: "alert",
		iconClass: "",
		bg: "bg-blue-1"
	},
	Success: {
		icon: "alert",
		iconClass: "",
		bg: "bg-blue-1"
	},
	Failure: {
		icon: "delete",
		iconClass: "fg-red-4",
		bg: "bg-red-1"
	}
} as const;

type ComponentProcessor = (
	node: InstanceNode,
	string: string) => object;

type FormioOptionProps = {
	label: string,
	value: string,
	shortcut: string
};

type FormioOptionValues = {
	values: FormioOptionProps[],
	defaultValue: Record<string, boolean>
};

const ComponentProcessors: Record<string, ComponentProcessor> = {
	"Checkbox": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "selectboxes",
			key: camelCase(props.labelText),
			tableView: false,
			inputType: "checkbox",
			optionsLabelPosition: "right",
			...getFormioProperties(props),
			...getFormioOptionProperties(node)
		};
	},
	"Radio": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "radio",
			key: camelCase(props.labelText),
			tableView: false,
			input: true,
			optionsLabelPosition: "right",
			...getFormioProperties(props),
			...getFormioOptionProperties(node)
		};
	},
	"Checkbox text": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "checkbox",
			key: camelCase(props.checkboxText),
			tableView: false,
			input: true,
			defaultValue: props.type === "Selected",
			...getFormioProperties(props)
		};
	},
	"Text field": (node) => {
		const props = getComponentProperties(node);
		const json: FormioJSON = {
			type: "textfield",
			key: camelCase(props.labelText),
			tableView: true,
			input: true,
			...getFormioProperties(props)
		};
		const prefix = String(props.type).match(/Prefix:\s+(\w+)/);

		if (prefix) {
				// the prefix types don't seem to have a showPlaceholderText option, so
				// the placeholder is always included, but we don't want the default
				// phone placeholder to be in the prefixed component
			delete json.placeholder;

			if (prefix[1] === "Currency") {
				json.prefix = "$";
			} else if (prefix[1] === "Date") {
				json.widget = {
					type: "calendar",
					altInput: true,
					allowInput: true,
					clickOpens: true,
					enableDate: true,
					enableTime: true,
					mode: "single",
					noCalendar: false,
					format: "yyyy-MM-dd hh:mm a",
					dateFormat: "yyyy-MM-ddTHH:mm:ssZ",
					useLocaleSettings: false,
					hourIncrement: 1,
					minuteIncrement: 5,
					time_24hr: false,
					saveAs: "text",
					displayInTimezone: "viewer",
					locale: "en"
				};
			}
		}

		return json;
	},
	"Text area": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "textarea",
			key: camelCase(props.labelText),
			autoExpand: false,
			tableView: true,
			input: true,
			...getFormioProperties(props)
		};
	},
	"Upload": (node) => {
		const props = getComponentProperties(node);

		return {
			type: "file",
			key: camelCase(props.labelText),
			tableView: false,
			input: true,
			storage: "azure",
			dir: "ooc-equity-mvp",
			webcam: true,
			fileTypes: [
				{
					label: "",
					value: ""
				}
			],
			...getFormioProperties(props)
		};
	},
	"Alert callouts": (node) => {
		const props = getComponentProperties(node);
		const { type, alertMessage } = props;
		const { icon, iconClass, bg } = AlertStylesByType[String(type)];

		return {
			type: "htmlelement",
			key: camelCase(alertMessage),
			label: `${type} alert`,
			tag: "div",
			content: `<span class="mr-2 ${iconClass}" data-icon="${icon}"></span>\n<span>\n${alertMessage}\n</span>\n`,
			className: `flex flex-items-start p-40 mt-40 mb-100 ${bg}`,
			tableView: false,
			input: false,
			lockKey: true,
			source: "61b7cba855627e36d98108ca",
			isNew: true,
			attrs: [
				{
					attr: "role",
					value: "alert"
				}
			],
			...getFormioProperties(props)
		};
	},
	"Fieldset": (node) => {
		const props = getComponentProperties(node);
		const json = JSON.parse(JSON.stringify(mailingAddress));

		json.label = props.labelText;
		json.key = camelCase(props.labelText);

		return json;
	},
} as const;

function getFormioOptionProperties(
	node: InstanceNode)
{
	return node.children
		.filter(isInstance)
		.filter(({ visible }) => visible)
		.reduce((result: FormioOptionValues, node) => {
			const { rowText, text, status } = getComponentProperties(node);
			const label = (rowText || text) as string;
			const value = camelCase(label);

			result.values.push({
				label,
				value,
				shortcut: ""
			});
			result.defaultValue[value] = status === "Selected";

			return result;
		}, { values: [], defaultValue: {} });
}

function getComponentProperties(
	node: InstanceNode): FigmaComponentProps
{
	const { componentProperties } = node;

	return Object.fromEntries(Object.entries(componentProperties).map(
		([key, value]) => [clean(key), value.value])
	);
}

function getComponentType(
	node: InstanceNode)
{
	const { mainComponent } = node;
	let type = "UNKNOWN";

	if (mainComponent) {
		if (mainComponent.parent) {
			type = mainComponent.parent.name;
		} else {
			type = mainComponent.name;
		}
	}

	return type;
}

export function getFormioJSON(
	node: InstanceNode)
{
	const type = getComponentType(node);
	const processor = ComponentProcessors[type];

	if (processor) {
		return processor(node, type);
	}

	return null;
}

export function getPanelJSON(
	node: FrameNode)
{
	const mainContent = findChildByPath(node, "Content area/Main content") as FrameNode;
	const pageTitle = findChildByName(mainContent, "Page title") as TextNode;
	const title = pageTitle?.characters;
	const components = mainContent.children.filter(isInstance)
		.map(getFormioJSON)
		.filter((node) => node);

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
