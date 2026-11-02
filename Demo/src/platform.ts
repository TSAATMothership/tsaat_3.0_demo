import { inflateSync } from "fflate";
import { demoPackage } from "./package";
export const performance = globalThis.performance;
export const inflateRawSync = (bytes: Uint8Array) => Buffer.from(inflateSync(bytes));
export const join = (...parts: string[]) => parts.join("/");
export default { join };
export async function readFile(file: string) {
  if (!file.replaceAll("\\", "/").endsWith("data/templates/network-target-state-template.xlsx")) {
    throw new Error(`File is not packaged for offline use: ${file}`);
  }
  return Buffer.from(demoPackage().template, "base64");
}
