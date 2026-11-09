/** Portable ZIP container for XLSX. Runtime generation uses only browser byte APIs. */
const LOCAL = 0x04034b50, CENTRAL = 0x02014b50, END = 0x06054b50;
const encoder = new TextEncoder(), decoder = new TextDecoder();

function view(bytes: Uint8Array) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function requireRange(bytes: Uint8Array, offset: number, length: number) {
  if (offset < 0 || length < 0 || offset + length > bytes.length) throw new Error("Invalid XLSX ZIP bounds.");
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function concat(parts: readonly Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}
interface Entry { name: string; method: number; bytes: Uint8Array; size: number; checksum: number }
function entriesIn(bytes: Uint8Array): Entry[] {
  const input = view(bytes);
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (input.getUint32(index, true) === END && index + 22 + input.getUint16(index + 20, true) === bytes.length) { end = index; break; }
  }
  if (end < 0) throw new Error("Invalid XLSX template: central directory not found.");
  const count = input.getUint16(end + 10, true);
  let offset = input.getUint32(end + 16, true);
  const entries: Entry[] = [], names = new Set<string>();
  for (let index = 0; index < count; index++) {
    requireRange(bytes, offset, 46);
    if (input.getUint32(offset, true) !== CENTRAL) throw new Error("Invalid XLSX template: corrupt central directory.");
    const method = input.getUint16(offset + 10, true), checksum = input.getUint32(offset + 16, true);
    const compressedSize = input.getUint32(offset + 20, true), size = input.getUint32(offset + 24, true);
    const nameLength = input.getUint16(offset + 28, true), extraLength = input.getUint16(offset + 30, true), commentLength = input.getUint16(offset + 32, true);
    const local = input.getUint32(offset + 42, true);
    requireRange(bytes, offset + 46, nameLength + extraLength + commentLength);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (names.has(name)) throw new Error("Invalid XLSX template: duplicate ZIP entry.");
    names.add(name);
    requireRange(bytes, local, 30);
    if (input.getUint32(local, true) !== LOCAL) throw new Error("Invalid XLSX template: corrupt local header.");
    const start = local + 30 + input.getUint16(local + 26, true) + input.getUint16(local + 28, true);
    requireRange(bytes, start, compressedSize);
    if (size > 64 * 1024 * 1024) throw new Error("XLSX template entry exceeds the supported size.");
    entries.push({ name, method, bytes: bytes.subarray(start, start + compressedSize), size, checksum });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function verified(entry: Entry, bytes: Uint8Array) {
  if (bytes.length !== entry.size || crc32(bytes) !== entry.checksum) throw new Error("Invalid XLSX template: entry integrity check failed.");
  return bytes;
}

/** Generated workbooks use STORE entries, so tests and callers can inspect them synchronously. */
export function readXlsxEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  return new Map(entriesIn(bytes).map(entry => {
    if (entry.method !== 0) throw new Error("Compressed XLSX entries require readXlsxEntriesAsync.");
    return [entry.name, verified(entry, entry.bytes)];
  }));
}

/** The committed Excel-authored template has DEFLATE entries; browsers provide decompression. */
export async function readXlsxEntriesAsync(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const entries = new Map<string, Uint8Array>();
  for (const entry of entriesIn(bytes)) {
    if (entry.method === 0) { entries.set(entry.name, verified(entry, entry.bytes)); continue; }
    if (entry.method !== 8) throw new Error(`Unsupported XLSX template compression method ${entry.method}.`);
    const compressed = Uint8Array.from(entry.bytes);
    const stream = new Blob([compressed.buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const output = new Uint8Array(await new Response(stream).arrayBuffer());
    entries.set(entry.name, verified(entry, output));
  }
  return entries;
}

export function writeXlsxEntries(entries: Map<string, Uint8Array>, generatedAt = new Date()): Uint8Array {
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("Invalid ZIP generation timestamp.");
  if (entries.size > 65535) throw new Error("Too many XLSX ZIP entries.");
  const year = Math.min(2107, Math.max(1980, generatedAt.getFullYear()));
  const date = ((year - 1980) << 9) | ((generatedAt.getMonth() + 1) << 5) | generatedAt.getDate();
  const time = (generatedAt.getHours() << 11) | (generatedAt.getMinutes() << 5) | Math.floor(generatedAt.getSeconds() / 2);
  const localParts: Uint8Array[] = [], centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBytes = encoder.encode(name), checksum = crc32(data);
    const local = new Uint8Array(30), central = new Uint8Array(46);
    const l = view(local), c = view(central);
    l.setUint32(0, LOCAL, true); l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true); l.setUint16(10, time, true); l.setUint16(12, date, true);
    l.setUint32(14, checksum, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, nameBytes.length, true);
    c.setUint32(0, CENTRAL, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, checksum, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nameBytes.length, true); c.setUint32(42, offset, true);
    localParts.push(local, nameBytes, data); centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
    if (offset > 0xffffffff) throw new Error("Workbook exceeds the supported ZIP size.");
  }
  const directory = concat(centralParts), end = new Uint8Array(22), e = view(end);
  e.setUint32(0, END, true); e.setUint16(8, entries.size, true); e.setUint16(10, entries.size, true);
  e.setUint32(12, directory.length, true); e.setUint32(16, offset, true);
  return concat([...localParts, directory, end]);
}
