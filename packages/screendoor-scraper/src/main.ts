import fs from "fs-extra";
import { CheerioCrawler, Dataset } from "crawlee";
import { writeToPath } from "fast-csv";

const SpacePattern = /[\n ]/g;	// literal non-breaking space character
const Headers = ["Response Number", "Response ID", "Timestamp", "Activity", "Message"];

// TODO: pull the form name from a CLI argument
const url = (responseNumber: string) => `https://screendoor.dobt.co/sfgovofficeofcannabis/office-of-cannabis-temporary-permit-application-2/admin/responses/${responseNumber}`;
//const url = (responseNumber: string) => `https://screendoor.dobt.co/sfgovofficeofcannabis/tell-the-city-you-want-to-be-an-equity-incubator/admin/responses/${responseNumber}`;

const clean = (string: string) => string.replace(SpacePattern, " ").trim();

const cookies = fs.readJsonSync("env/cookies.json");
// TODO: get list of responses from the API
const responses = fs.readFileSync("env/ids.tsv", "utf-8")
	.split("\n")
	.filter(row => row)
//.slice(0, 1)
	.map(row => row.split("\t"));

const requests = responses.map(([responseID, responseNumber, name]) => ({
	url: url(responseNumber),
	userData: {
		name,
		responseID,
		responseNumber
	}
}));

const crawler = new CheerioCrawler({
//	maxRequestsPerCrawl: 2,
	requestHandler: async ({ request, $ }) => {
		const { name, responseID, responseNumber } = request.userData;
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
			name,
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

await crawler.run(requests);

const dataset = await Dataset.open();
const { items } = await dataset.getData();
let rows: string[][] = [Headers];

items.forEach((item) => {
	const { activity } = item;

	rows = rows.concat(activity);
});

writeToPath("information_for_article_33_permit_holders_responses.csv", rows);
