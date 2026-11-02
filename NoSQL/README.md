# No-SQL build support

This folder holds the reviewed CMDB mapping and SQL calculation contract for the JSON-backed build of the main TSAAT app. It does not contain a second UI or standalone demo.

Run npm run build:nosql then npm run start:nosql from the repository root. Provision the normal login with npm run setup:login. The app uses NoSQL/data for mutable snapshots, reference definitions and saved settings, unless TSAAT_JSON_DATA_DIR selects another directory. Setup/build/start initialize missing stores from sample JSON and preserve existing data.

Runtime data is ignored by Git. Never delete it to update the app or overwrite it with seeds. Back it up and use reviewed format/data migrations. See [storage format, maintenance and recovery](../docs/data-providers.md).
