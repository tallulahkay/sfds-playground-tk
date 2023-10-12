{
const { getFieldsByName, loopChunks } = utils();
const nameMappings = getNameMappings();

const Basename = "Initial Application";
//const Basename = "General Operations";
//const Basename = "Business Ownership";
//const SubmissionsTableName = "TEST Business Ownership Submissions";
const SubmissionsTableName = Basename + " Submissions";

const table = base.getTable(SubmissionsTableName);
const fields = getFieldsByName(table);

const missingNames = nameMappings.filter(([formio, airtable]) => !(formio in fields) && !(airtable in fields));

if (missingNames.length) {
	throw new Error(`Some names in the mapping doc are not in the table:\n${missingNames.join("\n")}`);
}

const remainingNames = nameMappings.filter(([formio, airtable]) => !(formio in fields));

output.markdown(`Renaming **${remainingNames.length}** fields.`);

await loopChunks(remainingNames, 15, async (chunk) => {
	await Promise.all(chunk.map(([formio, airtable]) => fields[airtable].updateNameAsync(formio)));
})

output.markdown("**Done.**");


function getNameMappings()
{
	const NameMappingRows = `
firstName\tfirstName
lastName\tlastName
email\temail
DBAName\tDBAName
StreetAddress\tStreetAddress
bizOwnerNumber\tbizOwnerNumber
ownerCriteria1\townerCriteria1
bizOwnerName1\tbizOwnerName1
bizOwnerTitle1\tbizOwnerTitle1
bizOwnerEmail1\tbizOwnerEmail1
bizOwnerPhone1\tbizOwnerPhone1
bizOwnerAddress1.line1\tbizOwnerAddress1.line1
bizOwnerAddress1.line2\tbizOwnerAddress1.line2
bizOwnerAddress1.city\tbizOwnerAddress1.city
bizOwnerAddress1.state\tbizOwnerAddress1.state
bizOwnerAddress1.zip\tbizOwnerAddress1.zip
bizOwnerDateOfBirth1\tbizOwnerDateOfBirth1
bizOwnerPlaceOfBirth1\tbizOwnerPlaceOfBirth1
bizOwnerEmployer1\tbizOwnerEmployer1
bizOwnerPercent1\tbizOwnerPercent1
bizOwnerRevoked1\tbizOwnerRevoked1
bizOwnerConviction1\tbizOwnerConviction1
bizOwnerRace1\tbizOwnerRace1
bizOwnerNationality1\tbizOwnerNationality1
bizOwnerGender1\tbizOwnerGender1
\tbizOwnerGender1OtherScreendoor
bizOwnerEducationLevel1\tbizOwnerEducationLevel1
bizOwnerHouseholdIncome1\tbizOwnerHouseholdIncome1
bizOwnerHouseholdNumber1\tbizOwnerHouseholdNumber1
ownerCriteria2\townerCriteria2
bizOwnerName2\tbizOwnerName2
bizOwnerTitle2\tbizOwnerTitle2
bizOwnerEmail2\tbizOwnerEmail2
bizOwnerPhone2\tbizOwnerPhone2
bizOwnerAddress2.line1\tbizOwnerAddress2.line1
bizOwnerAddress2.line2\tbizOwnerAddress2.line2
bizOwnerAddress2.city\tbizOwnerAddress2.city
bizOwnerAddress2.state\tbizOwnerAddress2.state
bizOwnerAddress2.zip\tbizOwnerAddress2.zip
bizOwnerDateOfBirth2\tbizOwnerDateOfBirth2
bizOwnerPlaceOfBirth2\tbizOwnerPlaceOfBirth2
bizOwnerEmployer2\tbizOwnerEmployer2
bizOwnerPercent2\tbizOwnerPercent2
bizOwnerRevoked2\tbizOwnerRevoked2
bizOwnerConviction2\tbizOwnerConviction2
bizOwnerRace2\tbizOwnerRace2
bizOwnerNationality2\tbizOwnerNationality2
bizOwnerGender2\tbizOwnerGender2
\tbizOwnerGender2OtherScreendoor
bizOwnerEducationLevel2\tbizOwnerEducationLevel2
bizOwnerHouseholdIncome2\tbizOwnerHouseholdIncome2
bizOwnerHouseholdNumber2\tbizOwnerHouseholdNumber2
ownerCriteria3\townerCriteria3
bizOwnerName3\tbizOwnerName3
bizOwnerTitle3\tbizOwnerTitle3
bizOwnerEmail3\tbizOwnerEmail3
bizOwnerPhone3\tbizOwnerPhone3
bizOwnerAddress3.line1\tbizOwnerAddress3.line1
bizOwnerAddress3.line2\tbizOwnerAddress3.line2
bizOwnerAddress3.city\tbizOwnerAddress3.city
bizOwnerAddress3.state\tbizOwnerAddress3.state
bizOwnerAddress3.zip\tbizOwnerAddress3.zip
bizOwnerDateOfBirth3\tbizOwnerDateOfBirth3
bizOwnerPlaceOfBirth3\tbizOwnerPlaceOfBirth3
bizOwnerEmployer3\tbizOwnerEmployer3
bizOwnerPercent3\tbizOwnerPercent3
bizOwnerRevoked3\tbizOwnerRevoked3
bizOwnerConviction3\tbizOwnerConviction3
bizOwnerRace3\tbizOwnerRace3
bizOwnerNationality3\tbizOwnerNationality3
bizOwnerGender3\tbizOwnerGender3
\tbizOwnerGender3OtherScreendoor
bizOwnerEducationLevel3\tbizOwnerEducationLevel3
bizOwnerHouseholdIncome3\tbizOwnerHouseholdIncome3
bizOwnerHouseholdNumber3\tbizOwnerHouseholdNumber3
ownerCriteria4\townerCriteria4
bizOwnerName4\tbizOwnerName4
bizOwnerTitle4\tbizOwnerTitle4
bizOwnerEmail4\tbizOwnerEmail4
bizOwnerPhone4\tbizOwnerPhone4
bizOwnerAddress4.line1\tbizOwnerAddress4.line1
bizOwnerAddress4.line2\tbizOwnerAddress4.line2
bizOwnerAddress4.city\tbizOwnerAddress4.city
bizOwnerAddress4.state\tbizOwnerAddress4.state
bizOwnerAddress4.zip\tbizOwnerAddress4.zip
bizOwnerDateOfBirth4\tbizOwnerDateOfBirth4
bizOwnerPlaceOfBirth4\tbizOwnerPlaceOfBirth4
bizOwnerEmployer4\tbizOwnerEmployer4
bizOwnerPercent4\tbizOwnerPercent4
bizOwnerRevoked4\tbizOwnerRevoked4
bizOwnerConviction4\tbizOwnerConviction4
bizOwnerRace4\tbizOwnerRace4
bizOwnerNationality4\tbizOwnerNationality4
bizOwnerGender4\tbizOwnerGender4
\tbizOwnerGender4OtherScreendoor
bizOwnerEducationLevel4\tbizOwnerEducationLevel4
bizOwnerHouseholdIncome4\tbizOwnerHouseholdIncome4
bizOwnerHouseholdNumber4\tbizOwnerHouseholdNumber4
ownerCriteria5\townerCriteria5
bizOwnerName5\tbizOwnerName5
bizOwnerTitle5\tbizOwnerTitle5
bizOwnerEmail5\tbizOwnerEmail5
bizOwnerPhone5\tbizOwnerPhone5
bizOwnerAddress5.line1\tbizOwnerAddress5.line1
bizOwnerAddress5.line2\tbizOwnerAddress5.line2
bizOwnerAddress5.city\tbizOwnerAddress5.city
bizOwnerAddress5.state\tbizOwnerAddress5.state
bizOwnerAddress5.zip\tbizOwnerAddress5.zip
bizOwnerDateOfBirth5\tbizOwnerDateOfBirth5
bizOwnerPlaceOfBirth5\tbizOwnerPlaceOfBirth5
bizOwnerEmployer5\tbizOwnerEmployer5
bizOwnerPercent5\tbizOwnerPercent5
bizOwnerRevoked5\tbizOwnerRevoked5
bizOwnerConviction5\tbizOwnerConviction5
bizOwnerRace5\tbizOwnerRace5
bizOwnerNationality5\tbizOwnerNationality5
bizOwnerGender5\tbizOwnerGender5
\tbizOwnerGender5OtherScreendoor
bizOwnerEducationLevel5\tbizOwnerEducationLevel5
bizOwnerHouseholdIncome5\tbizOwnerHouseholdIncome5
bizOwnerHouseholdNumber5\tbizOwnerHouseholdNumber5
businessOwnerConvictionInformation1.convictionDate\tbusinessOwnerConvictionInformation1.convictionDate
businessOwnerConvictionInformation1.convictionDetails\tbusinessOwnerConvictionInformation1.convictionDetails
businessOwnerConvictionInformation1.wasThisPersonIncarcerated\tbusinessOwnerConvictionInformation1.wasThisPersonIncarcerated
businessOwnerConvictionInformation1.incarcerationStartDate\tbusinessOwnerConvictionInformation1.incarcerationStartDate
businessOwnerConvictionInformation1.incarcerationEndDate\tbusinessOwnerConvictionInformation1.incarcerationEndDate
businessOwnerConvictionInformation1.probation\tbusinessOwnerConvictionInformation1.probation
businessOwnerConvictionInformation1.probationStartDate\tbusinessOwnerConvictionInformation1.probationStartDate
businessOwnerConvictionInformation1.probationEndDate\tbusinessOwnerConvictionInformation1.probationEndDate
businessOwnerConvictionInformation1.uploadRehabilitationDocs.{UPLOAD}.1\tbusinessOwnerConvictionInformation1.uploadRehabilitationDocs
businessOwnerConvictionInformation2.convictionDate\tbusinessOwnerConvictionInformation2.convictionDate
businessOwnerConvictionInformation2.convictionDetails\tbusinessOwnerConvictionInformation2.convictionDetails
businessOwnerConvictionInformation2.wasThisPersonIncarcerated\tbusinessOwnerConvictionInformation2.wasThisPersonIncarcerated
businessOwnerConvictionInformation2.incarcerationStartDate\tbusinessOwnerConvictionInformation2.incarcerationStartDate
businessOwnerConvictionInformation2.incarcerationEndDate\tbusinessOwnerConvictionInformation2.incarcerationEndDate
businessOwnerConvictionInformation2.probation\tbusinessOwnerConvictionInformation2.probation
businessOwnerConvictionInformation2.probationStartDate\tbusinessOwnerConvictionInformation2.probationStartDate
businessOwnerConvictionInformation2.probationEndDate\tbusinessOwnerConvictionInformation2.probationEndDate
businessOwnerConvictionInformation2.uploadRehabilitationDocs.{UPLOAD}.1\tbusinessOwnerConvictionInformation2.uploadRehabilitationDocs
businessOwnerConvictionInformation3.convictionDate\tbusinessOwnerConvictionInformation3.convictionDate
businessOwnerConvictionInformation3.convictionDetails\tbusinessOwnerConvictionInformation3.convictionDetails
businessOwnerConvictionInformation3.wasThisPersonIncarcerated\tbusinessOwnerConvictionInformation3.wasThisPersonIncarcerated
businessOwnerConvictionInformation3.incarcerationStartDate\tbusinessOwnerConvictionInformation3.incarcerationStartDate
businessOwnerConvictionInformation3.incarcerationEndDate\tbusinessOwnerConvictionInformation3.incarcerationEndDate
businessOwnerConvictionInformation3.probation\tbusinessOwnerConvictionInformation3.probation
businessOwnerConvictionInformation3.probationStartDate\tbusinessOwnerConvictionInformation3.probationStartDate
businessOwnerConvictionInformation3.probationEndDate\tbusinessOwnerConvictionInformation3.probationEndDate
businessOwnerConvictionInformation3.uploadRehabilitationDocs.{UPLOAD}.1\tbusinessOwnerConvictionInformation3.uploadRehabilitationDocs
businessOwnerConvictionInformation4.convictionDate\tbusinessOwnerConvictionInformation4.convictionDate
businessOwnerConvictionInformation4.convictionDetails\tbusinessOwnerConvictionInformation4.convictionDetails
businessOwnerConvictionInformation4.wasThisPersonIncarcerated\tbusinessOwnerConvictionInformation4.wasThisPersonIncarcerated
businessOwnerConvictionInformation4.incarcerationStartDate\tbusinessOwnerConvictionInformation4.incarcerationStartDate
businessOwnerConvictionInformation4.incarcerationEndDate\tbusinessOwnerConvictionInformation4.incarcerationEndDate
businessOwnerConvictionInformation4.probation\tbusinessOwnerConvictionInformation4.probation
businessOwnerConvictionInformation4.probationStartDate\tbusinessOwnerConvictionInformation4.probationStartDate
businessOwnerConvictionInformation4.probationEndDate\tbusinessOwnerConvictionInformation4.probationEndDate
businessOwnerConvictionInformation4.uploadRehabilitationDocs.{UPLOAD}.1\tbusinessOwnerConvictionInformation4.uploadRehabilitationDocs
businessOwnerConvictionInformation5.convictionDate\tbusinessOwnerConvictionInformation5.convictionDate
businessOwnerConvictionInformation5.convictionDetails\tbusinessOwnerConvictionInformation5.convictionDetails
businessOwnerConvictionInformation5.wasThisPersonIncarcerated\tbusinessOwnerConvictionInformation5.wasThisPersonIncarcerated
businessOwnerConvictionInformation5.incarcerationStartDate\tbusinessOwnerConvictionInformation5.incarcerationStartDate
businessOwnerConvictionInformation5.incarcerationEndDate\tbusinessOwnerConvictionInformation5.incarcerationEndDate
businessOwnerConvictionInformation5.probation\tbusinessOwnerConvictionInformation5.probation
businessOwnerConvictionInformation5.probationStartDate\tbusinessOwnerConvictionInformation5.probationStartDate
businessOwnerConvictionInformation5.probationEndDate\tbusinessOwnerConvictionInformation5.probationEndDate
businessOwnerConvictionInformation5.uploadRehabilitationDocs.{UPLOAD}.1\tbusinessOwnerConvictionInformation5.uploadRehabilitationDocs
\tScreendoor conviction 1
\tScreendoor conviction 2
\tScreendoor conviction 3
\tScreendoor conviction 4
\tScreendoor conviction 5
entityOwners\tentityOwners
entityNumber\tentityNumber
businessNameEntity1\tbusinessNameEntity1
tradeNameEntity1\ttradeNameEntity1
businessAddressEntity1.line1\tbusinessAddressEntity1.line1
businessAddressEntity1.line2\tbusinessAddressEntity1.line2
businessAddressEntity1.city\tbusinessAddressEntity1.city
businessAddressEntity1.state\tbusinessAddressEntity1.state
businessAddressEntity1.zip\tbusinessAddressEntity1.zip
dateOfIncorporationEntity1\tdateOfIncorporationEntity1
percentageOfOwnershipEntity1\tpercentageOfOwnershipEntity1
ownershipStructureDetailsEntity1\townershipStructureDetailsEntity1
businessFormationDocs1.1.businesssFormationDocumentsEntity1.{UPLOAD}.1\tbusinesssFormationDocumentsEntity1.1
businessFormationDocs1.2.businesssFormationDocumentsEntity1.{UPLOAD}.1\tbusinesssFormationDocumentsEntity1.2
businessFormationDocs1.3.businesssFormationDocumentsEntity1.{UPLOAD}.1\tbusinesssFormationDocumentsEntity1.3
entityOwnerPersonEntity1.1.entityOwnerPerson.name\tentityOwnerPersonEntity1.entityOwnerPerson1.name
entityOwnerPersonEntity1.1.entityOwnerPerson.title\tentityOwnerPersonEntity1.entityOwnerPerson1.title
entityOwnerPersonEntity1.1.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity1.entityOwnerPerson1.dateOfBirth
entityOwnerPersonEntity1.1.entityOwnerPerson.email\tentityOwnerPersonEntity1.entityOwnerPerson1.email
entityOwnerPersonEntity1.1.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity1.entityOwnerPerson1.percentOwnership
entityOwnerPersonEntity1.2.entityOwnerPerson.name\tentityOwnerPersonEntity1.entityOwnerPerson2.name
entityOwnerPersonEntity1.2.entityOwnerPerson.title\tentityOwnerPersonEntity1.entityOwnerPerson2.title
entityOwnerPersonEntity1.2.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity1.entityOwnerPerson2.dateOfBirth
entityOwnerPersonEntity1.2.entityOwnerPerson.email\tentityOwnerPersonEntity1.entityOwnerPerson2.email
entityOwnerPersonEntity1.2.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity1.entityOwnerPerson2.percentOwnership
entityOwnerPersonEntity1.3.entityOwnerPerson.name\tentityOwnerPersonEntity1.entityOwnerPerson3.name
entityOwnerPersonEntity1.3.entityOwnerPerson.title\tentityOwnerPersonEntity1.entityOwnerPerson3.title
entityOwnerPersonEntity1.3.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity1.entityOwnerPerson3.dateOfBirth
entityOwnerPersonEntity1.3.entityOwnerPerson.email\tentityOwnerPersonEntity1.entityOwnerPerson3.email
entityOwnerPersonEntity1.3.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity1.entityOwnerPerson3.percentOwnership
entityOwnerPersonEntity1.4.entityOwnerPerson.name\tentityOwnerPersonEntity1.entityOwnerPerson4.name
entityOwnerPersonEntity1.4.entityOwnerPerson.title\tentityOwnerPersonEntity1.entityOwnerPerson4.title
entityOwnerPersonEntity1.4.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity1.entityOwnerPerson4.dateOfBirth
entityOwnerPersonEntity1.4.entityOwnerPerson.email\tentityOwnerPersonEntity1.entityOwnerPerson4.email
entityOwnerPersonEntity1.4.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity1.entityOwnerPerson4.percentOwnership
entityOwnerPersonEntity1.5.entityOwnerPerson.name\tentityOwnerPersonEntity1.entityOwnerPerson5.name
entityOwnerPersonEntity1.5.entityOwnerPerson.title\tentityOwnerPersonEntity1.entityOwnerPerson5.title
entityOwnerPersonEntity1.5.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity1.entityOwnerPerson5.dateOfBirth
entityOwnerPersonEntity1.5.entityOwnerPerson.email\tentityOwnerPersonEntity1.entityOwnerPerson5.email
entityOwnerPersonEntity1.5.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity1.entityOwnerPerson5.percentOwnership
businessNameEntity2\tbusinessNameEntity2
tradeNameEntity2\ttradeNameEntity2
businessAddressEntity2.line1\tbusinessAddressEntity2.line1
businessAddressEntity2.line2\tbusinessAddressEntity2.line2
businessAddressEntity2.city\tbusinessAddressEntity2.city
businessAddressEntity2.state\tbusinessAddressEntity2.state
businessAddressEntity2.zip\tbusinessAddressEntity2.zip
dateOfIncorporationEntity2\tdateOfIncorporationEntity2
percentageOfOwnershipEntity2\tpercentageOfOwnershipEntity2
ownershipStructureDetailsEntity2\townershipStructureDetailsEntity2
businessFormationDocs2.1.businesssFormationDocumentsEntity2.{UPLOAD}.1\tbusinesssFormationDocumentsEntity2.1
businessFormationDocs2.2.businesssFormationDocumentsEntity2.{UPLOAD}.1\tbusinesssFormationDocumentsEntity2.2
businessFormationDocs2.3.businesssFormationDocumentsEntity2.{UPLOAD}.1\tbusinesssFormationDocumentsEntity2.3
entityOwnerPersonEntity2.1.entityOwnerPerson.name\tentityOwnerPersonEntity2.entityOwnerPerson1.name
entityOwnerPersonEntity2.1.entityOwnerPerson.title\tentityOwnerPersonEntity2.entityOwnerPerson1.title
entityOwnerPersonEntity2.1.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity2.entityOwnerPerson1.dateOfBirth
entityOwnerPersonEntity2.1.entityOwnerPerson.email\tentityOwnerPersonEntity2.entityOwnerPerson1.email
entityOwnerPersonEntity2.1.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity2.entityOwnerPerson1.percentOwnership
entityOwnerPersonEntity2.2.entityOwnerPerson.name\tentityOwnerPersonEntity2.entityOwnerPerson2.name
entityOwnerPersonEntity2.2.entityOwnerPerson.title\tentityOwnerPersonEntity2.entityOwnerPerson2.title
entityOwnerPersonEntity2.2.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity2.entityOwnerPerson2.dateOfBirth
entityOwnerPersonEntity2.2.entityOwnerPerson.email\tentityOwnerPersonEntity2.entityOwnerPerson2.email
entityOwnerPersonEntity2.2.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity2.entityOwnerPerson2.percentOwnership
entityOwnerPersonEntity2.3.entityOwnerPerson.name\tentityOwnerPersonEntity2.entityOwnerPerson3.name
entityOwnerPersonEntity2.3.entityOwnerPerson.title\tentityOwnerPersonEntity2.entityOwnerPerson3.title
entityOwnerPersonEntity2.3.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity2.entityOwnerPerson3.dateOfBirth
entityOwnerPersonEntity2.3.entityOwnerPerson.email\tentityOwnerPersonEntity2.entityOwnerPerson3.email
entityOwnerPersonEntity2.3.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity2.entityOwnerPerson3.percentOwnership
entityOwnerPersonEntity2.4.entityOwnerPerson.name\tentityOwnerPersonEntity2.entityOwnerPerson4.name
entityOwnerPersonEntity2.4.entityOwnerPerson.title\tentityOwnerPersonEntity2.entityOwnerPerson4.title
entityOwnerPersonEntity2.4.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity2.entityOwnerPerson4.dateOfBirth
entityOwnerPersonEntity2.4.entityOwnerPerson.email\tentityOwnerPersonEntity2.entityOwnerPerson4.email
entityOwnerPersonEntity2.4.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity2.entityOwnerPerson4.percentOwnership
entityOwnerPersonEntity2.5.entityOwnerPerson.name\tentityOwnerPersonEntity2.entityOwnerPerson5.name
entityOwnerPersonEntity2.5.entityOwnerPerson.title\tentityOwnerPersonEntity2.entityOwnerPerson5.title
entityOwnerPersonEntity2.5.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity2.entityOwnerPerson5.dateOfBirth
entityOwnerPersonEntity2.5.entityOwnerPerson.email\tentityOwnerPersonEntity2.entityOwnerPerson5.email
entityOwnerPersonEntity2.5.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity2.entityOwnerPerson5.percentOwnership
businessNameEntity3\tbusinessNameEntity3
tradeNameEntity3\ttradeNameEntity3
businessAddressEntity3.line1\tbusinessAddressEntity3.line1
businessAddressEntity3.line2\tbusinessAddressEntity3.line2
businessAddressEntity3.city\tbusinessAddressEntity3.city
businessAddressEntity3.state\tbusinessAddressEntity3.state
businessAddressEntity3.zip\tbusinessAddressEntity3.zip
dateOfIncorporationEntity3\tdateOfIncorporationEntity3
percentageOfOwnershipEntity3\tpercentageOfOwnershipEntity3
ownershipStructureDetailsEntity3\townershipStructureDetailsEntity3
businessFormationDocs3.1.businesssFormationDocumentsEntity3.{UPLOAD}.1\tbusinesssFormationDocumentsEntity3.1
businessFormationDocs3.2.businesssFormationDocumentsEntity3.{UPLOAD}.1\tbusinesssFormationDocumentsEntity3.2
businessFormationDocs3.3.businesssFormationDocumentsEntity3.{UPLOAD}.1\tbusinesssFormationDocumentsEntity3.3
entityOwnerPersonEntity3.1.entityOwnerPerson.name\tentityOwnerPersonEntity3.entityOwnerPerson1.name
entityOwnerPersonEntity3.1.entityOwnerPerson.title\tentityOwnerPersonEntity3.entityOwnerPerson1.title
entityOwnerPersonEntity3.1.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity3.entityOwnerPerson1.dateOfBirth
entityOwnerPersonEntity3.1.entityOwnerPerson.email\tentityOwnerPersonEntity3.entityOwnerPerson1.email
entityOwnerPersonEntity3.1.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity3.entityOwnerPerson1.percentOwnership
entityOwnerPersonEntity3.2.entityOwnerPerson.name\tentityOwnerPersonEntity3.entityOwnerPerson2.name
entityOwnerPersonEntity3.2.entityOwnerPerson.title\tentityOwnerPersonEntity3.entityOwnerPerson2.title
entityOwnerPersonEntity3.2.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity3.entityOwnerPerson2.dateOfBirth
entityOwnerPersonEntity3.2.entityOwnerPerson.email\tentityOwnerPersonEntity3.entityOwnerPerson2.email
entityOwnerPersonEntity3.2.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity3.entityOwnerPerson2.percentOwnership
entityOwnerPersonEntity3.3.entityOwnerPerson.name\tentityOwnerPersonEntity3.entityOwnerPerson3.name
\tentityOwnerPersonEntity3.entityOwnerPerson3.title
entityOwnerPersonEntity3.3.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity3.entityOwnerPerson3.dateOfBirth
entityOwnerPersonEntity3.3.entityOwnerPerson.email\tentityOwnerPersonEntity3.entityOwnerPerson3.email
entityOwnerPersonEntity3.3.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity3.entityOwnerPerson3.percentOwnership
entityOwnerPersonEntity3.4.entityOwnerPerson.name\tentityOwnerPersonEntity3.entityOwnerPerson4.name
entityOwnerPersonEntity3.4.entityOwnerPerson.title\tentityOwnerPersonEntity3.entityOwnerPerson4.title
entityOwnerPersonEntity3.4.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity3.entityOwnerPerson4.dateOfBirth
entityOwnerPersonEntity3.4.entityOwnerPerson.email\tentityOwnerPersonEntity3.entityOwnerPerson4.email
entityOwnerPersonEntity3.4.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity3.entityOwnerPerson4.percentOwnership
entityOwnerPersonEntity3.5.entityOwnerPerson.name\tentityOwnerPersonEntity3.entityOwnerPerson5.name
entityOwnerPersonEntity3.5.entityOwnerPerson.title\tentityOwnerPersonEntity3.entityOwnerPerson5.title
entityOwnerPersonEntity3.5.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity3.entityOwnerPerson5.dateOfBirth
entityOwnerPersonEntity3.5.entityOwnerPerson.email\tentityOwnerPersonEntity3.entityOwnerPerson5.email
entityOwnerPersonEntity3.5.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity3.entityOwnerPerson5.percentOwnership
businessNameEntity4\tbusinessNameEntity4
tradeNameEntity4\ttradeNameEntity4
businessAddressEntity4.line1\tbusinessAddressEntity4.line1
businessAddressEntity4.line2\tbusinessAddressEntity4.line2
businessAddressEntity4.city\tbusinessAddressEntity4.city
businessAddressEntity4.state\tbusinessAddressEntity4.state
businessAddressEntity4.zip\tbusinessAddressEntity4.zip
dateOfIncorporationEntity4\tdateOfIncorporationEntity4
percentageOfOwnershipEntity4\tpercentageOfOwnershipEntity4
ownershipStructureDetailsEntity4\townershipStructureDetailsEntity4
businessFormationDocs4.1.businesssFormationDocumentsEntity4.{UPLOAD}.1\tbusinesssFormationDocumentsEntity4.1
businessFormationDocs4.2.businesssFormationDocumentsEntity4.{UPLOAD}.1\tbusinesssFormationDocumentsEntity4.2
businessFormationDocs4.3.businesssFormationDocumentsEntity4.{UPLOAD}.1\tbusinesssFormationDocumentsEntity4.3
entityOwnerPersonEntity4.1.entityOwnerPerson.name\tentityOwnerPersonEntity4.entityOwnerPerson1.name
entityOwnerPersonEntity4.1.entityOwnerPerson.title\tentityOwnerPersonEntity4.entityOwnerPerson1.title
entityOwnerPersonEntity4.1.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity4.entityOwnerPerson1.dateOfBirth
entityOwnerPersonEntity4.1.entityOwnerPerson.email\tentityOwnerPersonEntity4.entityOwnerPerson1.email
entityOwnerPersonEntity4.1.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity4.entityOwnerPerson1.percentOwnership
entityOwnerPersonEntity4.2.entityOwnerPerson.name\tentityOwnerPersonEntity4.entityOwnerPerson2.name
entityOwnerPersonEntity4.2.entityOwnerPerson.title\tentityOwnerPersonEntity4.entityOwnerPerson2.title
entityOwnerPersonEntity4.2.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity4.entityOwnerPerson2.dateOfBirth
entityOwnerPersonEntity4.2.entityOwnerPerson.email\tentityOwnerPersonEntity4.entityOwnerPerson2.email
entityOwnerPersonEntity4.2.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity4.entityOwnerPerson2.percentOwnership
entityOwnerPersonEntity4.3.entityOwnerPerson.name\tentityOwnerPersonEntity4.entityOwnerPerson3.name
entityOwnerPersonEntity4.3.entityOwnerPerson.title\tentityOwnerPersonEntity4.entityOwnerPerson3.title
entityOwnerPersonEntity4.3.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity4.entityOwnerPerson3.dateOfBirth
entityOwnerPersonEntity4.3.entityOwnerPerson.email\tentityOwnerPersonEntity4.entityOwnerPerson3.email
entityOwnerPersonEntity4.3.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity4.entityOwnerPerson3.percentOwnership
entityOwnerPersonEntity4.4.entityOwnerPerson.name\tentityOwnerPersonEntity4.entityOwnerPerson4.name
entityOwnerPersonEntity4.4.entityOwnerPerson.title\tentityOwnerPersonEntity4.entityOwnerPerson4.title
entityOwnerPersonEntity4.4.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity4.entityOwnerPerson4.dateOfBirth
entityOwnerPersonEntity4.4.entityOwnerPerson.email\tentityOwnerPersonEntity4.entityOwnerPerson4.email
entityOwnerPersonEntity4.4.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity4.entityOwnerPerson4.percentOwnership
entityOwnerPersonEntity4.5.entityOwnerPerson.name\tentityOwnerPersonEntity4.entityOwnerPerson5.name
entityOwnerPersonEntity4.5.entityOwnerPerson.title\tentityOwnerPersonEntity4.entityOwnerPerson5.title
entityOwnerPersonEntity4.5.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity4.entityOwnerPerson5.dateOfBirth
entityOwnerPersonEntity4.5.entityOwnerPerson.email\tentityOwnerPersonEntity4.entityOwnerPerson5.email
entityOwnerPersonEntity4.5.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity4.entityOwnerPerson5.percentOwnership
businessNameEntity5\tbusinessNameEntity5
tradeNameEntity5\ttradeNameEntity5
businessAddressEntity5.line1\tbusinessAddressEntity5.line1
businessAddressEntity5.line2\tbusinessAddressEntity5.line2
businessAddressEntity5.city\tbusinessAddressEntity5.city
businessAddressEntity5.state\tbusinessAddressEntity5.state
businessAddressEntity5.zip\tbusinessAddressEntity5.zip
dateOfIncorporationEntity5\tdateOfIncorporationEntity5
percentageOfOwnershipEntity5\tpercentageOfOwnershipEntity5
ownershipStructureDetailsEntity5\townershipStructureDetailsEntity5
businessFormationDocs5.1.businesssFormationDocumentsEntity5.{UPLOAD}.1\tbusinesssFormationDocumentsEntity5.1
businessFormationDocs5.2.businesssFormationDocumentsEntity5.{UPLOAD}.1\tbusinesssFormationDocumentsEntity5.2
businessFormationDocs5.3.businesssFormationDocumentsEntity5.{UPLOAD}.1\tbusinesssFormationDocumentsEntity5.3
entityOwnerPersonEntity5.1.entityOwnerPerson.name\tentityOwnerPersonEntity5.entityOwnerPerson1.name
entityOwnerPersonEntity5.1.entityOwnerPerson.title\tentityOwnerPersonEntity5.entityOwnerPerson1.title
entityOwnerPersonEntity5.1.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity5.entityOwnerPerson1.dateOfBirth
entityOwnerPersonEntity5.1.entityOwnerPerson.email\tentityOwnerPersonEntity5.entityOwnerPerson1.email
entityOwnerPersonEntity5.1.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity5.entityOwnerPerson1.percentOwnership
entityOwnerPersonEntity5.2.entityOwnerPerson.name\tentityOwnerPersonEntity5.entityOwnerPerson2.name
entityOwnerPersonEntity5.2.entityOwnerPerson.title\tentityOwnerPersonEntity5.entityOwnerPerson2.title
entityOwnerPersonEntity5.2.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity5.entityOwnerPerson2.dateOfBirth
entityOwnerPersonEntity5.2.entityOwnerPerson.email\tentityOwnerPersonEntity5.entityOwnerPerson2.email
entityOwnerPersonEntity5.2.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity5.entityOwnerPerson2.percentOwnership
entityOwnerPersonEntity5.3.entityOwnerPerson.name\tentityOwnerPersonEntity5.entityOwnerPerson3.name
entityOwnerPersonEntity5.3.entityOwnerPerson.title\tentityOwnerPersonEntity5.entityOwnerPerson3.title
entityOwnerPersonEntity5.3.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity5.entityOwnerPerson3.dateOfBirth
entityOwnerPersonEntity5.3.entityOwnerPerson.email\tentityOwnerPersonEntity5.entityOwnerPerson3.email
entityOwnerPersonEntity5.3.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity5.entityOwnerPerson3.percentOwnership
entityOwnerPersonEntity5.4.entityOwnerPerson.name\tentityOwnerPersonEntity5.entityOwnerPerson4.name
entityOwnerPersonEntity5.4.entityOwnerPerson.title\tentityOwnerPersonEntity5.entityOwnerPerson4.title
entityOwnerPersonEntity5.4.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity5.entityOwnerPerson4.dateOfBirth
entityOwnerPersonEntity5.4.entityOwnerPerson.email\tentityOwnerPersonEntity5.entityOwnerPerson4.email
entityOwnerPersonEntity5.4.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity5.entityOwnerPerson4.percentOwnership
entityOwnerPersonEntity5.5.entityOwnerPerson.name\tentityOwnerPersonEntity5.entityOwnerPerson5.name
entityOwnerPersonEntity5.5.entityOwnerPerson.title\tentityOwnerPersonEntity5.entityOwnerPerson5.title
entityOwnerPersonEntity5.5.entityOwnerPerson.dateOfBirth\tentityOwnerPersonEntity5.entityOwnerPerson5.dateOfBirth
entityOwnerPersonEntity5.5.entityOwnerPerson.email\tentityOwnerPersonEntity5.entityOwnerPerson5.email
entityOwnerPersonEntity5.5.entityOwnerPerson.percentOwnership\tentityOwnerPersonEntity5.entityOwnerPerson5.percentOwnership
\tScreendoor Entity 1
\tScreendoor Entity 2
\tScreendoor Entity 3
\tScreendoor Entity 4
\tScreendoor Entity Overflow
\tScreendoor Entity Owner 1
\tScreendoor Entity Owner 2
\tScreendoor Entity Owner 3
\tScreendoor Entity Owner 4
\tScreendoor Entity 5 Owner Overflow
additionalInvestors\tadditionalInvestors
investors.1.investor.name\tinvestors.investor1.name
investors.1.investor.investorType\tinvestors.investor1.investorType
investors.1.investor.percentOwnership\tinvestors.investor1.percentOwnership
investors.1.investor.whatIsTheInterestOrInvestment\tinvestors.investor1.whatIsTheInterestOrInvestment
investors.2.investor.name\tinvestors.investor2.name
investors.2.investor.investorType\tinvestors.investor2.investorType
investors.2.investor.percentOwnership\tinvestors.investor2.percentOwnership
investors.2.investor.whatIsTheInterestOrInvestment\tinvestors.investor2.whatIsTheInterestOrInvestment
investors.3.investor.name\tinvestors.investor3.name
investors.3.investor.investorType\tinvestors.investor3.investorType
investors.3.investor.percentOwnership\tinvestors.investor3.percentOwnership
investors.3.investor.whatIsTheInterestOrInvestment\tinvestors.investor3.whatIsTheInterestOrInvestment
investors.4.investor.name\tinvestors.investor4.name
investors.4.investor.investorType\tinvestors.investor4.investorType
investors.4.investor.percentOwnership\tinvestors.investor4.percentOwnership
investors.4.investor.whatIsTheInterestOrInvestment\tinvestors.investor4.whatIsTheInterestOrInvestment
investors.5.investor.name\tinvestors.investor5.name
investors.5.investor.investorType\tinvestors.investor5.investorType
investors.5.investor.percentOwnership\tinvestors.investor5.percentOwnership
investors.5.investor.whatIsTheInterestOrInvestment\tinvestors.investor5.whatIsTheInterestOrInvestment
investors.overflow\tinvestors.overflow
legalTrue\tlegalTrue
legalOmit\tlegalOmit
`;

	return NameMappingRows
		.split("\n")
		.filter(line => line)
		.map((line) => line.split("\t"))
		.filter(([formio, airtable]) => formio && airtable && formio !== airtable);
}

function utils() {
	const MaxChunkSize = 50;

	class GroupedArray {
		constructor(
			initialGroups = {})
		{
			this.groups = { ...initialGroups };
		}

		push(
			key,
			value)
		{
			const arr = this.groups[key] || (this.groups[key] = []);

			arr.push(value);
		}

		get(
			key)
		{
			return this.groups[key];
		}

		getAll()
		{
			return this.groups;
		}

		has(
			key)
		{
			return key in this.groups;
		}

		keys()
		{
			return Object.keys(this.groups);
		}

		values()
		{
			return Object.values(this.groups);
		}

		entries()
		{
			return Object.entries(this.groups);
		}

		forEach(
			iterator)
		{
			this.entries().forEach(([key, values]) => iterator(key, values));
		}
	}

	class Progress {
		constructor({
			total,
			done = 0,
			printStep = 10 })
		{
			const startingPct = (done / total) * 100;

			this.total = total;
			this.done = done;
			this.printStep = printStep;
			this.lastPctStep = startingPct - (startingPct % printStep) + printStep;
			this.startTime = Date.now();

			if (this.done > 0) {
				output.markdown(`Starting at **${this.pctString()}%**.`);
			}
		}

		increment(
			progress)
		{
			this.done += progress;

			if (this.pct() >= this.lastPctStep) {
					// we've past another full step, so print the current progress and the total time in seconds
				output.markdown(`**${this.pctString()}%** done \\[${((Date.now() - this.startTime) / 1000).toFixed(2)}s\\]`);
				this.lastPctStep += this.printStep;
			}
		}

		pct()
		{
			return (this.done / this.total) * 100;
		}

		pctString()
		{
			return this.pct().toFixed(1);
		}
	}

	async function loopChunks(
		items,
		chunkSize,
		loopFn)
	{
		if (typeof chunkSize === "function") {
			loopFn = chunkSize;
			chunkSize = MaxChunkSize;
		}

		const updateProgress = new Progress({
			total: items.length,
			printStep: 10
		});

			// we don't have any try/catch around the loopFn because trying to catch errors and then log what they are just
			// prints `name: "j"`, which is obviously useless (and par for the course with Airtable).  so let the inner loop
			// fail, which will print a better error message.
		for (let i = 0, len = items.length; i < len; i += chunkSize) {
			const chunk = items.slice(i, i + chunkSize);
			const result = await loopFn(chunk, i);

			updateProgress.increment(chunk.length);

			if (result === true) {
					// return true to break out of the loop early
				return;
			}
		}
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

	function getCellObject(
		record,
		fieldNames)
	{
		const result = [].concat(getCell(record, fieldNames));

		return Object.fromEntries(result.map((value, i) => [fieldNames[i], value]));
	}

	function getFieldsByName(
		table)
	{
		return table.fields.reduce((result, field) => {
			const { options } = field;

			if (options?.choices) {
					// extract the name strings from each choice so they're easier to access
				field.values = options.choices.map(({ name }) => name);
			}

			result[field.name] = field;

			return result;
		}, {});
	}

	async function getRecords(
		table,
		fields = [])
	{
		return (await table.selectRecordsAsync({ fields	})).records;
	}

	async function getRecordObjects(
		table,
		fieldNames)
	{
		return (await getRecords(table, fieldNames))
			.map((record) => getCellObject(record, fieldNames));
	}

	async function clearTable(
		table)
	{
		const { records } = await table.selectRecordsAsync({ fields: [] });

		output.markdown(`Deleting **${records.length}** records in the **${table.name}** table.`);

		await loopChunks(records, MaxChunkSize, (chunk) => table.deleteRecordsAsync(chunk));
	}

	async function confirmClearTable(
		table)
	{
		const { records } = await table.selectRecordsAsync({ fields: [] });

		if (records.length) {
			const deleteAllowed = await input.buttonsAsync(`Clear the "${table.name}" table?`, ["Yes", "No"]);

			if (deleteAllowed !== "Yes") {
				return false;
			}

			await clearTable(table);
		}

		return true;
	}

	function parseDate(
		dateString)
	{
		let date = new Date(dateString);

		if (isNaN(date)) {
				// this is an Invalid Date, because the dateString wasn't parseable, so try to make it so
			date = new Date(dateString.replace(/([ap]m)/, " $1"));
		}

		return date;
	}

	function by(
		iteratee,
		descending)
	{
		const order = descending ? -1 : 1;

		return (a, b) => {
			const keyA = typeof iteratee === "function" ? iteratee(a) : a[iteratee];
			const keyB = typeof iteratee === "function" ? iteratee(b) : b[iteratee];
			let result;

			if (typeof keyA === "string" && typeof keyB === "string") {
				const valueA = keyA.toUpperCase();
				const valueB = keyB.toUpperCase();

				if (valueA < valueB) {
					result = -1;
				} else if (valueA > valueB) {
					result = 1;
				} else {
					result = 0;
				}
			} else {
				result = keyA - keyB;
			}

			return result * order;
		};
	}

	async function confirm(
		label,
		buttons = ["Yes", "No"])
	{
		const answer = await input.buttonsAsync(label, buttons);

		return answer === buttons[0];
	}

	return {
		GroupedArray,
		Progress,
		loopChunks,
		getCell,
		getCellObject,
		getFieldsByName,
		getRecords,
		getRecordObjects,
		clearTable,
		confirmClearTable,
		parseDate,
		by,
		confirm,
	};
}

}
