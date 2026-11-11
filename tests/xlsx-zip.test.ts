import { readXlsxEntries, readXlsxEntriesAsync, writeXlsxEntries } from "@/lib/xlsx-zip";
import { describe, expect, it } from "vitest";
const encode = (value: string) => new TextEncoder().encode(value);
describe("browser XLSX ZIP container", () => {
    it("round-trips Unicode names and arbitrary binary entries with browser byte APIs", async () => {
        const entries = new Map([["content/展示.xml", encode("<value>日本語 &amp; café</value>")], ["media/image.bin", new Uint8Array([0, 255, 17, 6])]]);
        const bytes = writeXlsxEntries(entries, new Date("2026-11-09T05:00:00Z"));
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(readXlsxEntries(bytes)).toEqual(entries);
        expect(await readXlsxEntriesAsync(bytes)).toEqual(entries);
    });
    it("rejects truncated and corrupted entries instead of emitting a partial workbook", () => {
        const bytes = writeXlsxEntries(new Map([["value.xml", encode("original")]]));
        expect(() => readXlsxEntries(bytes.slice(0, -8))).toThrow(/central directory/);
        bytes[30 + encode("value.xml").length] ^= 1;
        expect(() => readXlsxEntries(bytes)).toThrow(/integrity/);
        expect(() => writeXlsxEntries(new Map(), new Date(NaN))).toThrow(/timestamp/);
    });
});
