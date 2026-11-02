import fs from "node:fs";
import crypto from "node:crypto";
const contract = JSON.parse(fs.readFileSync("NoSQL/calculation-contract.json", "utf8").replace(/^\uFEFF/, ""));
for (const [file, expected] of Object.entries(contract.files)) {
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (crypto.createHash("sha256").update(source).digest("hex") !== expected) throw new Error(file + ": review SQL/JSON provider behavior and regression tests before updating NoSQL/calculation-contract.json.");
}
if (fs.existsSync("Demo")) throw new Error("The retired Demo folder must not return. Use the shared SQL and No-SQL builds.");
console.log("SQL/JSON calculation review contract verified.");
