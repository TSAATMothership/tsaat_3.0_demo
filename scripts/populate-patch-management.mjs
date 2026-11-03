import path from "node:path";
import { fileURLToPath } from "node:url";
import { populateJsonStore } from "./populate-json-store.mjs";
import { validateDemoDataset } from "./enrich-demo-dataset.mjs";
import { enrichPatchManagement, PATCH_SAMPLE_PROFILE } from "./enrich-patch-management.mjs";
export async function populatePatchManagement(options = {}) {
  return populateJsonStore({ ...options, profile: PATCH_SAMPLE_PROFILE, transformDataset: dataset => {
    validateDemoDataset(dataset); return enrichPatchManagement(dataset);
  } });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {}, args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--demo") options.demo = true;
    else if (["--target", "--backup-directory"].includes(arg) && args[index + 1] && !args[index + 1].startsWith("--")) options[arg === "--target" ? "target" : "backupDirectory"] = args[++index];
    else throw new Error("Usage: npm run populate:patches -- [--target directory] [--apply --demo] [--backup-directory directory]");
  }
  try { console.log(JSON.stringify(await populatePatchManagement(options), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
