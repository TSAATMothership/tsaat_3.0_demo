import { inflateSync } from "fflate";
import { BrowserBuffer } from "../browser-buffer";

export function inflateRawSync(input: Uint8Array): BrowserBuffer {
  return BrowserBuffer.from(inflateSync(input));
}
