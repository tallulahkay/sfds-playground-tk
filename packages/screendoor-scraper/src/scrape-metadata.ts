import fs from "fs-extra";
import { CheerioCrawler, Dataset } from "crawlee";
import TurndownService from "turndown";
import parseArgs from "minimist";
import "dotenv/config";
import { Totals } from "./Totals.js";

	// create a service to map HTML to markdown
const turndown = new TurndownService();

	// ignore the OOC dept image that's at the top of most emails
turndown.addRule("img", {
	filter: "img",
	replacement: () => ""
});

const responseURL = (projectName: string, responseNumber: string) => `https://screendoor.dobt.co/sfgovofficeofcannabis/${projectName}/admin/responses/${responseNumber}`;
const responsesAPI = ({ projectID = 0, api_key = "", page = 0, per_page = 100 }) => `https://screendoor.dobt.co/api/projects/${projectID}/responses?v=1&api_key=${api_key}&per_page=${per_page}&page=${page}`;

function getArgs(
	argString = process.argv.slice(2))
{
	const { _: [command], ...flags } = parseArgs(argString);
	const { formName, formID, output = `${formName}.csv` } = flags;

	return { command, flags: { formName, formID, output } };
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
	const requests: object[] = [];
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

// TODO: change this to project name and ID

const { flags: { formName, formID, output } } = getArgs();

console.log(formName, formID, output);

if (!formName || !formID) {
	console.log("`formName` and `formID` parameters are required.");
	process.exit(1);
}

const formIDs = new Totals();
const requests = await getAllRequests(formName, formID, formIDs);

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

// TODO: if there are multiple labels in the header, separate with commas, or surround with []

			if (time.length) {
				const timestamp = $("time", time).attr("datetime");
				const event = $(".activity_label", el).text() || $(".activity_header", el).text();
					// the .activity_message_full element seems to not get filled out until
					// the card is expanded, so grab the text from partial card, which does
					// not include the metadata elements, unfortunately
				const messageContainer = $(".activity_message_partial", el);
				const comment = $(".activity_card_body", el);
				let message = "";

// TODO: convert comment to markdown?  maybe also convert labels to ` ` or other formatted string

				if (messageContainer.length) {
					const subject = $("header", messageContainer).text();
					const body = turndown.turndown($(".message_mailer_body .rendered_from_wysiwyg", messageContainer).html() ?? "");

					message = `### ${subject}\n\n${body}`;
				} else if (comment.length) {
					message = comment.text();
				}

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

	// sort by the response number.  the response ID won't necessarily be in the same order.
metadataItems = metadataItems.sort((a, b) => (a.timestamp - b.timestamp));
metadataItems = metadataItems.sort((a, b) => (a.responseNumber - b.responseNumber));

	// change the timestamp to PDT format, since Airtable isn't adjusting the timezone
//rows = rows.map(({ timestamp, ...rest }) => ({ ...rest, timestamp: new Date(timestamp).toLocaleString() }));

fs.writeJSONSync(output, metadataItems, { spaces: "\t" });

// TODO: fix curly quotes.  need to save it as utf8?  or use the xlsx export?
