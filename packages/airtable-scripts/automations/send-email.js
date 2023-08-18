const EmailFields = {
	Subject: "Email Subject",
	To: "Email To",
	CC: "Email CC",
	From: "Email From",
	Body: "Email Body",
};
const SourceFields = {
	SubmissionID: "SUBMISSION_ID",
	Template: "Email Template",
	Modified: "Last Modified - Submissions",
	Project: "PROJECT_ID",
	...EmailFields,
};
const PermitsTableName = "Cannabis Business Permit Reviews";
const PermitFields = {
	Status: "Initial Application Status",
	SubmissionID: "SUBMISSION_ID (from Initial Application - Latest Submission)",
};
const NotesBaseNames = [
	"About You",
	"Your Eligibility",
	"Additional Contacts",
	"About Your Business",
	"Business Information",
	"Permit Details",
	"Planning Department Point of Contact",
	"Authority to Operate",
	"Business Structure",
	"Permit Types",
	"Legal Agreements"
];
const SectionNotesFields = NotesBaseNames.map(name => `${name} Section Notes`);
const PreviousNotesFields = SectionNotesFields.map(name => `Previous ${name}`);
const NotesFormulaFields = SectionNotesFields.map(name => `${name} formula`);
const PermitNotesFields = NotesBaseNames.map(name => `Initial Cannabis Business Application - Previous ${name} Notes`);
const ActivityTableName = "Activity History";
const ActivityFields = {
	Title: "Activity Title",
	Time: "Activity Time",
	Project: "Project ID",
	Form: "Form",
	Type: "Status Type",
	Subject: "Email Subject",
	Link: "Initial Application Submissions",
	ID: "Submission ID",
};
const TemplateStatusMap = {
	"Request edits to this submission": "Sent to applicant for edits",
	"Resend the edit link": "Sent to applicant for edits",
	"Accept this submission": "Approved",
};
const RecordURLPattern = /\/(tbl\w+)\/(rec\w+)/;

async function findRecord(
	table,
	target,
	fields = [])
{
	if (Array.isArray(target)) {
		const [fieldName, fieldValue] = target;

			// make sure the field names are unique
		fields = [...new Set([...fields, fieldName])];
		target = (record) => record.getCellValueAsString(fieldName) === fieldValue;
	}

	const results = await table.selectRecordsAsync({ fields });

	return results.records.find(target)
}

function getCell(
	record,
	fieldNames)
{
	const names = [].concat(fieldNames);
	const result = names.map((name) => record.getCellValueAsString(name));

	return result.length > 1
		? result
		: result[0];
}

async function sendEmail(
	url,
	key,
	{ subject, to, cc, body })
{
	const json = {
		subject,
		to: [{ email: to }],
		from: {
			email: "officeofcannabis@sfgov.org",
			name: "Office of Cannabis"
		},
		content: [
			{
				type: "text/plain",
				value: body
			}
		]
	};

	if (cc) {
		json.cc = [{ email: cc }];
	}

	const response = await fetch(url, {
		method: "POST",
		body: JSON.stringify(json),
		headers: {
			"Content-Type": "application/json",
			"x-apikey": key,
		}
	});
	const { status } = await response.json();

	if (status !== "success") {
		throw new Error(`Send email failed: ${status}`);
	}
}

const { recordURL, apiURL, apiKey } = input.config();
	// the Base Record URL contains the table and record IDs, which we'll need to find the record itself
const [, sourceTableID, sourceRecordID] = recordURL.match(RecordURLPattern);

const sourceTable = base.getTable(sourceTableID);
const sourceRecord = await sourceTable.selectRecordAsync(sourceRecordID);
const [submissionID, template, lastModified, projectID, subject, to, cc, from, body] =
	getCell(sourceRecord, Object.values(SourceFields));
	// ugly hack to convert the timezone-less local time to a parseable UTC string
const lastModifiedDate = new Date(lastModified.replace(/([ap]m)/, " $1 UTC"));

console.log("source record", sourceRecord, submissionID, template, lastModified, subject);

if (!(template in TemplateStatusMap)) {
	throw new Error(`Unknown template: ${template}`);
}

await sendEmail(apiURL, apiKey, { subject, to, cc, body });

console.log("sent email");

	// clear the email fields from where the user entered them in the source record
await sourceTable.updateRecordAsync(sourceRecord,
		// map the email-related keys to empty strings
	Object.fromEntries(Object.values(EmailFields).map(name => [name, ""])));

console.log("cleared email fields in source record");

const reviewsTable = base.getTable(PermitsTableName);
const reviewRecord = await findRecord(reviewsTable, [PermitFields.SubmissionID, submissionID]);

await reviewsTable.updateRecordAsync(reviewRecord,
	{ [PermitFields.Status]: { name: TemplateStatusMap[template] } });

	// create a hash of the permit review field names with the current note formula values
const previousNotes = getCell(sourceRecord, NotesFormulaFields);
const updatedNotesFields = Object.fromEntries(previousNotes.map((note, i) => [PermitNotesFields[i], note]));

	// update the permit review record with the latest notes
await reviewsTable.updateRecordAsync(reviewRecord, updatedNotesFields);

console.log("updated review record");

// this is another approach, without using the formula fields
/*
const lastModifiedDateString = lastModifiedDate.toLocaleString();
const notes = getCell(sourceRecord, SectionNotesFields);
console.log("notes", notes);
const previousNotes = getCell(sourceRecord, PreviousNotesFields);
console.log("previous notes", previousNotes);

const updatedNotesFields = notes.reduce((result, note, i) => {
	if (note) {
		const combinedNote =
`${lastModifiedDateString}:
${note}

~~                   ~~
\`\`\`

\`\`\`
----------
${previousNotes[i]}
`;

		result[PermitNotesFields[i]] = combinedNote;
	}

	return result;
}, {});

console.log(updatedNotesFields);
*/

const activityTable = base.getTable(ActivityTableName);

await activityTable.createRecordAsync({
	[ActivityFields.Title]: `Email sent: ${template}`,
	[ActivityFields.Time]: lastModifiedDate,
	[ActivityFields.Project]: projectID,
	[ActivityFields.Form]: { name: "Initial Application" },
	[ActivityFields.Type]: { name: "Submission" },
	[ActivityFields.Subject]: subject,
	[ActivityFields.Link]: [sourceRecord],
	[ActivityFields.ID]: submissionID,
});

console.log("added activity history");
