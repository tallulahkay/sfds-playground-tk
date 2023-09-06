	// "import" these utilities from the functions at the end of this script
const { getCell, getCellHash, getFieldsByName, loopChunks, deleteTable } = utils();
const { getIDByEmail } = equityIDs();

const Basename = "Equity Incubator";
const ScreendoorTableName = "SCREENDOOR_EQUITY_INCUBATOR";
const ScreendoorRevTableName = "SCREENDOOR_EQUITY_INCUBATOR_REV";
const ScreendoorFields = [
	"SUBMITTED_AT",
	"RESPONSE_ID",
	"RESPONSE_NUM",
	"RESPONSE_JSON",
	"AIRTABLE_JSON",
];
const SubmissionsTableName = Basename + " Submissions";
const SubmissionFields = {
	ID: "RESPONSE_ID",
	Num: "RESPONSE_NUM",
	SubmissionID: "SUBMISSION_ID",
	Submitted: "Submitted",
	FormulaID: "ID",
	Email: "email"
};
const ReviewsTableName = Basename + " Reviews";
const ReviewFields = {
	ID: "ID",
	MostRecent: "Most Recent Submission",
	Previous: "Previous Submissions",
	ReviewStatus: "Review Status",
	SubmissionStatus: "Submission Status",
	EquityID: "Equity Incubator ID",
};

const startTime = Date.now();

const submissionsTable = base.getTable(SubmissionsTableName);
const reviewsTable = base.getTable(ReviewsTableName);

const deleteAllowed = await input.buttonsAsync(`Clear the ${Basename} submissions and reviews tables?`, ["Yes", "No"]);

if (deleteAllowed !== "Yes") {
	return;
}

await deleteTable(submissionsTable);
await deleteTable(reviewsTable);

const screendoorTable = base.getTable(ScreendoorTableName);
const screendoorRevTable = base.getTable(ScreendoorRevTableName);
	// combine the original submissions and revisions into one list for processing
const screendoorRecords = [
	...(await screendoorTable.selectRecordsAsync({
		fields: ScreendoorFields
	})).records,
	...(await screendoorRevTable.selectRecordsAsync({
		fields: ScreendoorFields
	})).records
]
		// hack the submitted date string into something parseable without moment.js, and store it with the record, so we
		// can sort the array by the date next
	.map((record) => ([new Date(getCell(record, ScreendoorFields[0]).replace(/([ap]m)/, " $1")), record]))
	.sort((a, b) => b[0] - a[0]);

const submissionFieldsByName = getFieldsByName(submissionsTable);
const submissions = screendoorRecords.map(([submitted, record], i) => {
	const [responseID, responseNum, screendoorJSON, airtableJSON] = getCell(record, ScreendoorFields.slice(1));

	if (!airtableJSON) {
			// some of the Screendoor records don't have any converted Airtable JSON associated with them, possibly
			// because they're from an old form we're not migrating.  so ignore those records.
		console.log(`Skipping empty Airtable JSON: ${i} ${record.id} ${responseID} ${submitted} ${screendoorJSON.slice(0, 200)}`);

		return null;
	}

	const airtableData = JSON.parse(airtableJSON);
	const screendoorData = JSON.parse(screendoorJSON);

	Object.entries(airtableData).forEach(([key, value]) => {
		const { type } = submissionFieldsByName[key];

			// the JSON is coming in with bare strings for select values, so fix those
		if (type === "singleSelect") {
			airtableData[key] = { name: value };
		} else if (type === "multipleSelects") {
			airtableData[key] = value.map((name) => ({ name }));
		} else if (key.includes(".upload")) {
				// break the comma-delimited files into one per line
			airtableData[key] = value.replace(/,/g, "\n");
		} else if (typeof value === "string") {
				// extra spaces at the beginning or end of some fields can cause issues, so trim them
			airtableData[key] = value.trim();
		}
	});

		// we have to convert the submitted date from a Date object to an ISO string in order to write it into a record
	airtableData.Submitted = submitted.toISOString();

		// this key is in the Airtable JSON, but for the revisions, it's not the ID of the original submission; it's some
		// other, unrelated ID.  but we need the original response ID to link the revisions to the originals.  so overwrite
		// the RESPONSE_ID field in the Airtable data with the one from Screendoor.  the revisions also won't have the
		// sequential_id in the JSON, so take it from the RESPONSE_NUM field in the record.
	airtableData.RESPONSE_ID = responseID;
	airtableData.RESPONSE_NUM = responseNum;

	if (!("initial_response_id" in screendoorData)) {
			// current submissions will have a blank SUBMISSION_ID, while revisions will have a 0 in the field.  this makes
			// it possible to distinguish them when generating Form.io records.
		airtableData.SUBMISSION_ID = "0";
	}

	return { fields: airtableData };
})
		// filter out any records with no JSON
	.filter((record) => !!record);

const submissionRecordIDsByResponse = {};

output.markdown(`Starting import of ${submissions.length} submissions...`);

await loopChunks(submissions, async (chunk) => {
	const records = await submissionsTable.createRecordsAsync(chunk);

	chunk.forEach((submission, i) => {
		const { fields: { [SubmissionFields.ID]: id } } = submission;
		const submissionRecords = (submissionRecordIDsByResponse[id] || (submissionRecordIDsByResponse[id] = []));

		submissionRecords.push({ id: records[i] });
	});
});

const reviews = [];

output.markdown(`Starting creation of ${Object.keys(submissionRecordIDsByResponse).length} reviews...`);

	// step through each set of related submissions
for (const [latestID, ...previousIDs] of Object.values(submissionRecordIDsByResponse)) {
		// get the created record for the most recent submission, so we can get any fields set by formulas
		// that we need to use when generating the review data below
	const latestRecord = await submissionsTable.selectRecordAsync(latestID.id);
	const latest = getCellHash(latestRecord, Object.values(SubmissionFields));
	const equityID = getIDByEmail(latest.email);

	if (!equityID) {
		console.error(`No equity ID found for ${latest.email}.`);
	}

	reviews.push({
		fields: {
			[ReviewFields.ID]: latest.ID,
			[ReviewFields.MostRecent]: [latestID],
			[ReviewFields.Previous]: previousIDs,
			[ReviewFields.ReviewStatus]: { name: "Processed" },
			[ReviewFields.SubmissionStatus]: { name: "Equity Incubator ID assigned" },
			[ReviewFields.EquityID]: equityID,
		}
	});
}

await loopChunks(reviews, (chunk) => reviewsTable.createRecordsAsync(chunk));

output.markdown(`Total time: **${((Date.now() - startTime) / 1000).toFixed(2)}s** at ${new Date().toLocaleString()}`);


// =======================================================================================
// these reusable utility functions can be "imported" by destructuring the functions below
// =======================================================================================

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

	function getCellHash(
		record,
		fieldNames)
	{
		const result = [].concat(getCell(record, fieldNames));

		return Object.fromEntries(result.map((value, i) => [fieldNames[i], value]));
	}

	function getFieldsByName(
		table)
	{
		return table.fields.reduce((result, field) => ({
			...result,
			[field.name]: field
		}), {});
	}

	async function deleteTable(
		table)
	{
		const { records } = await table.selectRecordsAsync({ fields: [] });

		output.markdown(`Deleting ${records.length} records in the **${table.name}** table.`);

		await loopChunks(records, MaxChunkSize, (chunk) => table.deleteRecordsAsync(chunk));
	}

	return {
		GroupedArray,
		Progress,
		loopChunks,
		getCell,
		getCellHash,
		getFieldsByName,
		deleteTable,
	};
}

function equityIDs() {
	const idsByEmail = {
		"core@haveaheartcc.com": "204180029",
		"ryanchou1234@yahoo.com": "204180017",
		"brianyoung92@gmail.com": "204180020",
		"kennethschlesinger@yahoo.com": "204180032",
		"mike@evolvetherapeutics.com": "204180023",
		"mac@kindcourier.com": "204180011",
		"infofogcity@gmail.com": "204180024",
		"csquan168@gmail.com": "204180009",
		"amir@deltafederation.com": "204180012",
		"lgomez@ngr-sf.com": "204180016",
		"greenfieldgroup44@gmail.com": "204180022",
		"paul@cannafornia.co": "204180010",
		"nealchou@yahoo.com": "204180018",
		"elaine@little-emperor.com": "204180019",
		"thesecretspot.inc@gmail.com": "204180025",
		"mike@spirulinex.com": "204180021",
		"alexander.fabian@treehaus.us": "204180027",
		"jkotzker@strainwise.com": "204180013",
		"joshua.eugene.chase@gmail.com": "204180028",
		"info.muud@gmail.com": "204180015",
		"moore.phae@gmail.com": "204180030",
		"omar.amrousy@gmail.com": "204180026",
		"tk@folsomforge.com": "204180014",
		"vipuldayal@gmail.com": "204180033",
		"priya@medmen.com": "204180031",
		"dilov88@gmail.com": "205180034",
		"johnnymetheny@yahoo.com": "205180035",
		"kenthillhomes@gmail.com": "205180036",
		"goldenstatelegends2015@gmail.com": "205180038",
		"scotthillhomes@gmail.com": "205180039",
		"mgcllcmd@gmail.com": "205180040",
		"chris@emergent.law": "205180041",
		"jo@sparcsf.org": "205180042",
		"danny@tacosandtrees.com": "205180043",
		"contact@downunderindustries.com": "205180044",
		"ray@castroplace.com": "205180046",
		"rashaan@growingtalent.org": "205180047",
		"enlighten.sf@gmail.com": "205180048",
		"jose@jpinvests.com": "205180049",
		"josh@dosist.com": "205180050",
		"jose@highdemandrealestate.com": "205180053",
		"treeinhaler180@gmail.com": "205180052",
		"cnwlicensing@gmail.com": "205180054",
		"joeycannata2@gmail.com": "205180055",
		"dtran818@gmail.com": "205180056",
		"parth@somalsp.com": "205180057",
		"hsimmons415@gmail.com": "205180058",
		"baileychan35@gmail.com": "205180059",
		"tushar.sethi1@gmail.com": "205180060",
		"david@tru-qual.com": "205180061",
		"allambitar2018@gmail.com": "205180062",
		"phuman9@gmail.com": "205180063",
		"wbjon82@yahoo.com": "205180064",
		"tselarry@hotmail.com": "206180065",
		"dustin@mstreetstrat.com": "206180066",
		"laurabirch04@gmail.com": "206180067",
		"thedavidkaufman@gmail.com": "206180068",
		"therestorativecollective@gmail.com": "206180069",
		"matt@freegoldwatch.com": "206180070",
		"tonywill167@yahoo.com": "206180071",
		"william@ezblazesf.com": "209180072",
		"verbotensf@gmail.com": "209180073",
		"lhan88@gmail.com": "209180074",
		"melonie.green@mytpd.com": "209180075",
		"fillmoreco@aol.com": "209180076",
		"kenstephen2@gmail.com": "209180077",
		"anh@plantacea.org": "209180078",
		"mnaw209@gmail.com": "209180079",
		"jon@grooveroom.club": "209190080",
		"huangandy1@hotmail.com": "210180081",
		"josephsobocan@gmail.com": "210180082",
		"edgewater5353@gmail.com": "210180083",
		"msummers@harvestinc.com": "210180084",
		"pedro.r.garcia@gmail.com": "210180085",
		"andrea@jackalopegardens.com": "210180086",
		"paul@ogradyplumbing.com": "210180087",
		"addsignsure@gmail.com": "210180088",
		"amerikanprofit@gmail.com": "210180089",
		"suzy.gfp@gmail.com": "210180090",
		"schoisf@gmail.com": "210180091",
		"jonathanshiff@yahoo.com": "210180092",
		"cyn@neweratribe.com": "210180093",
		"the.kobal@gmail.com": "201190094",
		"farmstarzsf@gmail.com": "201190095",
		"adelariss@gmail.com": "201190096",
		"kevin@harvestlaw.com": "201190097",
		"john@solibrium.com": "202190098",
		"ml@ma-firm.com": "202190099",
		"mahal@mahalmontoya.com": "210200140",
		"danishaker@gmail.com": "203190101",
		"yehiaaeissa@gmail.com": "204190102",
		"info@greenlightventureholding.com": "204190103",
		"info@thegreenbelievers.com": "204190104",
		"skycloudstore@gmail.com": "204190105",
		"dorlistareed@gmail.com": "205190106",
		"jason@coffee-cultures.com": "207190107",
		"qquinney7700@yahoo.com": "208190108",
		"kappasigmati@gmail.com": "208190109",
		"awasinju@gmail.com": "209190110",
		"info@e7ca.com": "209190111",
		"5lelandincubator@gmail.com": "209190112",
		"kira@estaterealtyca.com": "209190113",
		"lohilounge@gmail.com": "209190114",
		"ehud@lissauer.net": "209190115",
		"desmondcleaver@gmail.com": "211190116",
		"ojhahari78@gmail.com": "211190117",
		"binayapokharel12@yahoo.com": "211190118",
		"equity@leaders420.com": "211190119",
		"friends@jaywalkcreative.com": "212190120",
		"joedowell2@gmail.com": "212200121",
		"ken@rooted.group": "201200124",
		"jaredk+worldly@gmail.com": "201200123",
		"stevejerant@gmail.com": "204200125",
		"paulmuchowski@definedresearch.com": "204200126",
		"millionairewithab@gmail.com": "205200127",
		"ahmettasci@gmail.com": "205200128",
		"procommshop@gmail.com": "207200129",
		"mishka@mmdshops.com": "207200130",
		"cvessentialssf@gmail.com": "207200131",
		"change4fivehundred@gmail.com": "207200132",
		"maarifa@cannabisprogrammatic.com": "207200133",
		"rebecca@claybythebay.com": "208200134",
		"kashishjuneja12@gmail.com": "208200135",
		"chahal_rajan@hotmail.com": "208200136",
		"jburgos415@gmail.com": "209200137",
		"vanessa@dropdelivery.com": "210200138",
		"tm69habash@yahoo.com": "210200139",
		"vinceman18@gmail.com": "201210141",
		"team@yerbabuenasf.biz": "201210142",
		"conorj@otterbrands.com": "201210143",
		"carriepriddle@gmail.com": "204210146",
		"steve@schinkolaw.com": "205210147",
		"redeyedistrict2020@gmail.com": "206210150",
		"21parkrd@gmail.com": "208210151",
		"lmgroupsf@gmail.com": "208210152",
		"bobby@420seasons.com": "208210153",
		"rkgoodri@gmail.com": "209210156",
		"mrlathan@gmail.com": "209210158",
		"sfpurplestar@gmail.com": "209210161",
		"ed.mat.brown@gmail.com": "209210162",
		"gavinallc@gmail.com": "209210167",
		"hello@trellis.social": "209210168",
		"adriansky@me.com": "209210169",
		"andrewmilks@gmail.com": "209210170",
		"710sfinc@gmail.com": "210210172",
		"jeffnbean@aol.com": "210210173",
		"paul@marfa420.com": "210210174",
		"boutahdollaclothing@gmail.com": "210210175",
		"jack.brown@gmail.com": "211210176",
		"frank.nelstone@higherrolling.com": "201220178",
		"caleb.regulatory@connectedca.com": "202220179",
		"exec@urbananow.com": "203220180",
		"cali.kori88@gmail.com": "203220181",
		"pete.crowley@gmail.com": "206220182",
		"greenspace@homespace.biz": "206220183",
		"cornea.loosest09@icloud.com": "206220184",
		"thedjwong@yahoo.com": "207220185",
		"yenidentarim@gmail.com": "207220186",
		"admin@armadalawyers.com": "209220187",
		"eandtenterprisesgroupllc@gmail.com": "209220188",
		"contact51percent@gmail.com": "210220189",
		"dabagllc@gmail.com": "212220190",
		"ramihajar@hotmail.com": "202230191",
		"luciasconsulting@gmail.com": "20423192",
		"kharlilm@me.com": "204230193",
		"ryanchou426@gmail.com": "206230194",
		"orestestzortzis@yahoo.com": "208230195"
	};

	return {
		getIDByEmail(email)
		{
			return typeof email === "string"
				? idsByEmail[email.toLowerCase()]
				: undefined;
		}
	};
}
