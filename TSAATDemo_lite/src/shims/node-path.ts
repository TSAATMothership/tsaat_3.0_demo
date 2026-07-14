function normalizePart(value: unknown): string {
  return String(value ?? "").replace(/\\/g, "/");
}

export function join(...parts: unknown[]): string {
  const joined = parts.map(normalizePart).filter(Boolean).join("/").replace(/\/{2,}/g, "/");
  return joined.startsWith("/") ? joined : `/${joined}`;
}

export function resolve(...parts: unknown[]): string {
  return join(...parts);
}

export function dirname(value: string): string {
  const normalized = normalizePart(value).replace(/\/$/, "");
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

export function basename(value: string): string {
  return normalizePart(value).replace(/\/$/, "").split("/").pop() ?? "";
}

const path = { join, resolve, dirname, basename, sep: "/" };
export default path;
