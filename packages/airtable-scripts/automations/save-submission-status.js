const PermitsTableName = "Event Permit Reviews";
const ActivityTableName = "Activity History";

const PermitFields = {
	SubmissionStatus: "Submission Status",
	LastModified: "Last Modified - Review",
	LinkedSubmissionID: "SUBMISSION_ID (from Most Recent Submission)",
};
const PermitStatus = {
	SentForEdits: "Sent to applicant for edits",
	EditsReceived: "New edits received",
};
	// generate a list of numbered fields, 1 to 5
const PermitTargetFieldsByStatus = {
	[PermitStatus.SentForEdits]: nameRange(5, i => `Edit - Sent to Applicant for Edits ${i} Date`),
	[PermitStatus.EditsReceived]: nameRange(5, i => `Edit - New Edits Received ${i} Date`),
};
const ActivityFields = {
	Title: "Activity Title",
	Time: "Activity Time",
	Type: "Activity Type",
	Link: "Event Permit Reviews",
	Status: "Status",
	ID: "Submission ID",
};

function nameRange(
	count,
	name)
{
	return Array.from(Array(count), (_, i) => i + 1).map(name);
}

async function updateAvailableField(
	table,
	record,
	fieldNames,
	newFieldValue)
{
		// get the values for the target fields
	const fieldValues = fieldNames.map((field) => record.getCellValue(field));
		// find the first empty field.  default to the last field if we don't find an empty one.
	const availableFieldIndex = fieldValues.findIndex((value, i, array) => !value || i === array.length - 1);
	const availableFieldName = fieldNames[availableFieldIndex];

	await table.updateRecordAsync(record, { [availableFieldName]: newFieldValue });

	return availableFieldName;
}

const { id } = input.config();
const reviewsTable = base.getTable(PermitsTableName);
const activityTable = base.getTable(ActivityTableName);

const reviewRecord = await reviewsTable.selectRecordAsync(id);

if (reviewRecord) {
	const statusChoice = reviewRecord.getCellValue(PermitFields.SubmissionStatus);

	if (!statusChoice) {
		return;
	}

	const status = statusChoice.name;
	const lastModified = reviewRecord.getCellValue(PermitFields.LastModified);
		// link record fields return an array, even with just one link
	const [linkedID] = reviewRecord.getCellValue(PermitFields.LinkedSubmissionID);

	await activityTable.createRecordAsync({
		[ActivityFields.Title]: status,
		[ActivityFields.Link]: [reviewRecord],
		[ActivityFields.Time]: lastModified,
		[ActivityFields.ID]: linkedID,
		[ActivityFields.Type]: { name: "Status" },
		[ActivityFields.Status]: { name: status },
	});

	if (Object.values(PermitStatus).includes(status)) {
		const updatedFieldName = await updateAvailableField(
			reviewsTable,
			reviewRecord,
			PermitTargetFieldsByStatus[status],
			lastModified
		);

		console.log(`Updated '${updatedFieldName}' with ${lastModified}.`);
	} else {
		console.error(`Script called with unrecognized status: ${status}.`);
	}
} else {
	console.error(`Could not find permit record '${id}'.`);
}
