import type { DemoPackage } from "../Demo/src/package";
export function createDemoPackage(): DemoPackage;
export function packageReferences(): Record<string, unknown>;
export function buildDemo(options?: { check?: boolean }): Promise<void>;
