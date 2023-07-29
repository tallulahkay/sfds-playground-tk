# Airtable Scripts

These scripts are intended to be copy-and-pasted into Script Extension fields inside Airtable.  There doesn't appear to be any way to load remote scripts into a base, unfortunately.


## [add-fields-from-spreadsheet.js](src/add-fields-from-spreadsheet.js)

> Adds rich-text fields as specified in a `.xlsx` spreadsheet to a chosen table.

The spreadsheet should have a header row, which is ignored.  Each row specifies the name of the field, which is each cell combined with ` - `.  If there's an existing field with that name, no new field is added.


## [add-record-from-json.js](src/add-record-from-json.js)

> Creates Airtable records from Screendoor JSON, using a quick-and-dirty mapping

1. Choose a destination table.
2. Choose a JSON file with one or more Screendoor records in it.
3. Choose a `.xlsx` mapping file.
4. Choose which worksheet in the spreadsheet should be used to map the Screendoor data.

The mapping spreadsheet should have columns labeled `Airtable field name`, `Airtable Field types`, and `Screendoor ID`, though case is ignored.  Multi- and single-select fields are ignored, since mapping their values is done in the JSONata files.


## [diff-submissions.js](src/diff-submissions.js)

> Diffs the two most recent business application submissions

After a record with a previous submission is selected, the fields with different values will be printed out, showing each current and previous value.


## [generate-fields-from-mapping.js](src/generate-fields-from-mapping.js)

> Generates fields from a mapping doc

1. Choose whether to create a new table or insert fields into an existing one.
2. Enter the name of the new table, or select the existing one.
3. Choose a `.xlsx` mapping file.
4. Choose which worksheet in the spreadsheet should be used to map the Screendoor data.

The mapping spreadsheet should have columns labeled `Airtable field name`, `Airtable Field types`, and `Screendoor ID`, though case is ignored.

For each field that matches a pattern like  `{fieldName} Notes`, two other fields will be created: `Previous {fieldName} Notes` and `{fieldName} Notes formula`.  The formula for that field is also printed out as text, since it's not possible to script the creation of a formula field.


## [import-metadata.js](src/import-metadata.js)

> Imports and links Screendoor metadata

The script expects the metadata to have been imported into a table called `Metadata` and that it will be linked to records in `Cannabis Business Permit Reviews`, using the metadata's `Response Number`.  Metadata that doesn't have a matching record is ignored.

Records are updated in batches of the maximum 50 at a time.


## [list-fields-with-bad-options.js](src/list-fields-with-bad-options.js)

> Lists select selection fields with options that contain return chars

The name of each field and its options that contain invisible `\r` characters is printed out.  A list of tables that were checked and had no bad fields is also printed.


## [strip-return-chars.js](src/strip-return-chars.js)

> Strips return characters from field options

After a table is chosen, the script will strip return characters from any options in selection fields that contain them.
