# 🎩 forml

Use YAML to create a Form.io form.


## Install

```shell
npx degit fwextensions/sfds-playground/packages/forml
npm install
npm run dev
```

Open the `localhost` address listed in the shell.  Then edit the [form.yaml](form.yaml) file and save it to see the form update.

The [listing.json](listing.json) file represents the data for a DAHLIA rental listing.  Removing the NRHP preference from the `Listing_Lottery_Preferences` array and saving the file will also remove the *NRHP* panel, since we want the form flow to depend on the details of the listing.
