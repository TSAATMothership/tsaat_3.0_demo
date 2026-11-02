import { gunzipSync, strFromU8 } from "fflate";
export interface DemoPackage {
  snapshots: Array<{ date: string; json: string }>;
  references: Record<string, unknown>;
  template: string;
  logo: string;
}
let current: DemoPackage | undefined;
export function configureDemoPackage(value: DemoPackage) { current = value; }
export function demoPackage(): DemoPackage {
  if (!current) current = JSON.parse(document.getElementById("demo-data")!.textContent!) as DemoPackage;
  return current;
}
export function unpackJson<T>(encoded: string): T {
  return JSON.parse(strFromU8(gunzipSync(Uint8Array.from(atob(encoded), c => c.charCodeAt(0))))) as T;
}
