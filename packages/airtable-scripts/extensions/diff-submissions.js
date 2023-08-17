const IgnoredFieldPattern = / (Notes|formula|\(Lookup\))$/i;

const submissionsTable = base.getTable("Initial Application Submissions");
const reviewsTable = base.getTable("Cannabis Business Permit Reviews");

const recordInfo = await input.recordAsync(
	"Select an Initial Application that has previous submissions:",
	reviewsTable,
);

if (!recordInfo) {
	return;
}

const reviewRecord = await reviewsTable.selectRecordAsync(recordInfo.id);
const [{ id: currID, name }, { id: prevID }] = reviewRecord.getCellValue("Initial Application - Previous Submissions");

if (!(currID && prevID)) {
	console.error("The selected record does not have previous submissions.");

	return;
}

const curr = await submissionsTable.selectRecordAsync(currID);
const prev = await submissionsTable.selectRecordAsync(prevID);
const { fields } = submissionsTable;

let differerences = 0;

output.markdown(`## ${name}`);

for (const field of fields) {
	if (!IgnoredFieldPattern.test(field.name)) {
		const currField = curr.getCellValueAsString(field);
		const prevField = prev.getCellValueAsString(field);

		if (currField !== prevField) {
			differerences++;
			output.markdown(
`#### ${field.name}

~~\`${prevField}\`~~

\`${currField}\``
			);
		}
	}
}

output.markdown(`**${differerences}** differences found.`);
