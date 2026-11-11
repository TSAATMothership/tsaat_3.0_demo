import { normalizeEditableDatabaseConnectionInput } from "../lib/db-config";
import { testDatabaseConnection, testDatabaseSchema, testDatabaseSsl } from "../lib/database-settings";

async function main() {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const settings = normalizeEditableDatabaseConnectionInput(JSON.parse(input.replace(/^\uFEFF/, "")));
  for (const check of [testDatabaseConnection, testDatabaseSsl, testDatabaseSchema]) {
    const result = await check(settings);
    console.log(result.diagnostics);
    if (!result.success) {
      process.exitCode = 1;
      return;
    }
  }
}

main().catch(() => {
  console.error("Unable to validate database settings. Check the supplied values and installed application dependencies.");
  process.exitCode = 1;
});
