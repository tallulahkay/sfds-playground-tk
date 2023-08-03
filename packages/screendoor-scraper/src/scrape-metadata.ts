import fs from "fs-extra";
import {
	CheerioCrawler,
	Dataset,
	RequestOptions
} from "crawlee";
import TurndownService from "turndown";
import parseArgs from "minimist";
import "dotenv/config";
import { Totals } from "./Totals.js";

const SpacePattern = / /g;	// literal non-breaking space character

const clean = (string: string) => string.replace(SpacePattern, " ").trim();

	// create a service to map HTML to markdown
const turndown = new TurndownService();

turndown
		// ignore the OOC dept image that's at the top of most emails
	.addRule("img", {
		filter: "img",
		replacement: () => ""
	})
	.addRule("label", {
		filter: (node: HTMLElement) => node.nodeName === "SPAN" && node.classList.contains("label"),
		replacement: (content) => `\`${content}\` `
	});

const responseURL = (projectName: string, responseNumber: string) => `https://screendoor.dobt.co/sfgovofficeofcannabis/${projectName}/admin/responses/${responseNumber}`;
const responsesAPI = ({ projectID = 0, api_key = "", page = 0, per_page = 100 }) => `https://screendoor.dobt.co/api/projects/${projectID}/responses?v=1&api_key=${api_key}&per_page=${per_page}&page=${page}`;

function getArgs(
	argString = process.argv.slice(2))
{
	const { _: [command], ...flags } = parseArgs(argString);
	const { projectName, projectID, output = `${projectName}.json` } = flags;

	return { command, flags: { projectName, projectID, output } };
}

async function fetchJSON(
	url: string)
{
	const response = await fetch(url);

	return response.json();
}

async function getAllRequests(
	projectName: string,
	projectID: number,
	formIDs: Totals)
{
	const requests: RequestOptions[] = [];
	const api_key = process.env.SCREENDOOR_KEY;
	let page = 0;
	let responseCount = 0;

	do {
		const responses = await fetchJSON(responsesAPI({
			projectID,
			api_key,
			page,
		}));

		if (!responses || responses.error) {
			responseCount = 0;
			console.error(responses.error);

			break;
		} else {
			console.log(page, responses.length);

			page++;
			responseCount = responses.length;

			responses.forEach((response) => {
				const { id, sequential_id, initial_response_id, form_id } = response;

				formIDs.add(form_id);
				requests.push({
					url: responseURL(projectName, sequential_id),
					userData: {
						responseID: id,
						responseNumber: sequential_id,
						formID: form_id,
						initialID: initial_response_id
					}
				});
			});
		}
	} while (responseCount);

	return requests;
}

const { flags: { projectName, projectID, output } } = getArgs();

if (!projectName || !projectID) {
	console.log("`projectName` and `projectID` parameters are required.");
	process.exit(1);
}

const formIDs = new Totals();
const requests = await getAllRequests(projectName, projectID, formIDs);

console.log("Found form IDs:\n", formIDs.all());

const cookies = fs.readJsonSync("env/cookies.json");

const crawler = new CheerioCrawler({
//	maxRequestsPerCrawl: 2,
	requestHandler: async ({ request, $ }) => {
		const { responseID, responseNumber, formID, initialID } = request.userData;
		const activityItems = $("li.activity_item:not(.js_comment_form_li)");
		const items: object[] = [];

		activityItems.each((_, el) => {
			const time = $("span[class^='activity_time']", el);

			if (time.length) {
				const timestamp = $("time", time).attr("datetime");
					// messages have a plain text activity_label, while the activity_header contains
					// span.label elements that we want to convert to code spans
				const event = $(".activity_label", el).text()
					|| turndown.turndown($(".activity_header", el).html() ?? "");
					// the .activity_message_full element seems to not get filled out until
					// the card is expanded, so grab the text from partial card, which does
					// not include the metadata elements, unfortunately
				const messageContainer = $(".activity_message_partial", el);
				const comment = $(".activity_card_body", el);
				let message = "";

				if (messageContainer.length) {
					const subject = $("header", messageContainer).text();
					const body = turndown.turndown($(".message_mailer_body .rendered_from_wysiwyg", messageContainer).html() ?? "");

					message = `### ${subject}\n\n${body}`;
				} else if (comment.length) {
					message = comment.text();
				}

					// remove non-breaking spaces from the message
				message = clean(message);

				items.push({
					formID,
					responseID,
					responseNumber,
					initialID,
					timestamp,
					event,
					message
				});
			}
		});

		await Dataset.pushData({
			responseID,
			responseNumber,
			url: request.url,
			activity: items
		});
	},
	preNavigationHooks: [({ session, request }) => {
			// seems like the only way to add cookies is to inject them via this handler
		session?.setCookies(cookies, request.url);
	}],
});

//await crawler.run(requests.slice(0, 20));
await crawler.run(requests);

const dataset = await Dataset.open();
const { items } = await dataset.getData();
let metadataItems: object[] = [];

items.forEach((item) => {
	const { activity } = item;

	metadataItems = metadataItems.concat(activity);
});

	// sort by descending date/time and then by the response ID
metadataItems = metadataItems.sort((a, b) => (b.timestamp - a.timestamp));
metadataItems = metadataItems.sort((a, b) => (a.responseID - b.responseID));

fs.writeJSONSync(output, metadataItems, { spaces: "\t" });
