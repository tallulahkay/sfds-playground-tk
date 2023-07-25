import fs from "fs-extra";
import { CheerioCrawler, Dataset } from "crawlee";
import { writeToPath } from "fast-csv";
import parseArgs from "minimist";
import "dotenv/config";

const SpacePattern = /[\n ]/g;	// literal non-breaking space character
const Headers = ["Response Number", "Response ID", "Timestamp", "Activity", "Message"];

const responseURL = (projectName: string, responseNumber: string) => `https://screendoor.dobt.co/sfgovofficeofcannabis/${projectName}/admin/responses/${responseNumber}`;
const responsesAPI = ({ projectID = 0, api_key = "", page = 0, per_page = 100 }) => `https://screendoor.dobt.co/api/projects/${projectID}/responses?v=1&api_key=${api_key}&per_page=${per_page}&page=${page}`;

const clean = (string: string) => string.replace(SpacePattern, " ").trim();

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
	projectID: number)
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

			responses.forEach(({ id, sequential_id }) => {
				requests.push({
					url: responseURL(projectName, sequential_id),
					userData: {
						responseID: id,
						responseNumber: sequential_id
					}
				});
			});
		}
	} while (responseCount);

	return requests;
}

const { flags: { formName, formID, output } } = getArgs();

console.log(formName, formID, output);

if (!formName || !formID) {
	console.log("`formName` and `formID` parameters are required.");
	process.exit(1);
}

const requests = await getAllRequests(formName, formID);

const cookies = fs.readJsonSync("env/cookies.json");

const crawler = new CheerioCrawler({
//	maxRequestsPerCrawl: 2,
	requestHandler: async ({ request, $ }) => {
		const { responseID, responseNumber } = request.userData;
		const activityItems = $("li.activity_item:not(.js_comment_form_li)");
		const rows: any[] = [];

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

				if (messageContainer.length) {
					const subject = $("header", messageContainer).text();
					const body = $(".message_mailer_body .rendered_from_wysiwyg", messageContainer).text();

					message = `'${subject}': ${body}`;
				} else if (comment.length) {
					message = comment.text();
				}

// TODO: change timestamp to PDT format, since Airtable isn't adjusting the timezone

				rows.push([
					responseID,
					responseNumber,
					timestamp,
					event,
						// strip any newlines from the message text, so that it doesn't
						// wrap to the next row in the spreadsheet, and replace non-breaking
						// spaces with regular ones
					clean(message)
				]);
			}
		});

		await Dataset.pushData({
			responseID,
			responseNumber,
			url: request.url,
			activity: rows
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
let rows: string[][] = [Headers];

items.forEach((item) => {
	const { activity } = item;

	rows = rows.concat(activity);
});

	// sort by the response number.  the response ID won't necessarily be in the same order.
rows = rows.sort((a, b) => (a[1] - b[1]));

writeToPath(output, rows);

// TODO: fix curly quotes.  need to save it as utf8?  or use the xlsx export?
