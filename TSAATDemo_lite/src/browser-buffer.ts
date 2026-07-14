type BufferInput = string | ArrayBuffer | ArrayBufferView | ArrayLike<number>;

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export class BrowserBuffer extends Uint8Array {
  static from(arrayLike: ArrayLike<number>): BrowserBuffer;
  static from<T>(arrayLike: ArrayLike<T>, mapfn: (value: T, index: number) => number, thisArg?: unknown): BrowserBuffer;
  static from(elements: Iterable<number>): BrowserBuffer;
  static from(input: string, encoding?: string): BrowserBuffer;
  static from(
    input: BufferInput | Iterable<number>,
    encodingOrMap: string | ((value: unknown, index: number) => number) = "utf8",
    thisArg?: unknown
  ): BrowserBuffer {
    if (typeof input === "string") {
      const bytes = encodingOrMap === "base64" ? bytesFromBase64(input) : new TextEncoder().encode(input);
      return new BrowserBuffer(bytes);
    }
    if (typeof encodingOrMap === "function") {
      return new BrowserBuffer(Array.from(input as Iterable<unknown>, encodingOrMap, thisArg));
    }
    if (ArrayBuffer.isView(input)) {
      return new BrowserBuffer(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
    }
    if (input instanceof ArrayBuffer) {
      return new BrowserBuffer(new Uint8Array(input));
    }
    return new BrowserBuffer(Array.from(input as Iterable<number>));
  }

  static alloc(length: number): BrowserBuffer {
    return new BrowserBuffer(length);
  }

  static concat(parts: readonly Uint8Array[]): BrowserBuffer {
    const length = parts.reduce((total, part) => total + part.byteLength, 0);
    const result = new BrowserBuffer(length);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.byteLength;
    }
    return result;
  }

  override subarray(begin?: number, end?: number): BrowserBuffer {
    const view = super.subarray(begin, end);
    return new BrowserBuffer(view.buffer, view.byteOffset, view.byteLength);
  }

  override toString(encoding: string = "utf8"): string {
    if (encoding === "base64") {
      let binary = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < this.length; offset += chunkSize) {
        binary += String.fromCharCode(...this.subarray(offset, Math.min(this.length, offset + chunkSize)));
      }
      return btoa(binary);
    }
    return new TextDecoder().decode(this);
  }

  readUInt16LE(offset: number): number {
    return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint16(offset, true);
  }

  readUInt32LE(offset: number): number {
    return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint32(offset, true);
  }

  writeUInt16LE(value: number, offset: number): number {
    new DataView(this.buffer, this.byteOffset, this.byteLength).setUint16(offset, value, true);
    return offset + 2;
  }

  writeUInt32LE(value: number, offset: number): number {
    new DataView(this.buffer, this.byteOffset, this.byteLength).setUint32(offset, value, true);
    return offset + 4;
  }
}

export function installBrowserBuffer(): void {
  (globalThis as unknown as { Buffer: typeof BrowserBuffer }).Buffer = BrowserBuffer;
}
