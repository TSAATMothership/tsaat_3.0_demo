import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDatasetSecurityDomains } from "../lib/security-domain.mjs";
import { populateJsonStore } from "./populate-json-store.mjs";
import { validateDemoDataset } from "./enrich-demo-dataset.mjs";

export async function migrateSecurityDomains(options = {}) {
  return populateJsonStore({ ...options, migration: "security-domains-v1", profile: "security-domains-v1", transformDataset: dataset => {
    validateDemoDataset(dataset);
    return normalizeDatasetSecurityDomains(dataset);
  } });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {}, args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--apply") options.apply = true;
    else if (["--target", "--backup-directory"].includes(arg) && args[index + 1] && !args[index + 1].startsWith("--")) options[arg === "--target" ? "target" : "backupDirectory"] = args[++index];
    else throw new Error("Usage: npm run migrate:security-domains -- [--target directory] [--apply] [--backup-directory directory]");
  }
  try { console.log(JSON.stringify(await migrateSecurityDomains(options), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
