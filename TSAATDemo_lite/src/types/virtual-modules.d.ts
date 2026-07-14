declare module "virtual:embedded-data" {
  export const embeddedFiles: Record<
    string,
    { gzip?: string; alias?: string; kind?: "snapshot" | "text" | "binary" }
  >;
  export const sharedSnapshotChunk: string;
  export const snapshotHeaders: Record<string, string>;
}

declare module "virtual:embedded-assets" {
  export const assets: Record<string, string>;
  export const workerSource: string;
}

declare var __TSAAT_NAVIGATE__: (href: string, replace?: boolean) => void;
declare var __TSAAT_WORKER_URL__: string;
declare var __TSAAT_ASSETS__: Record<string, string>;
declare var __TSAAT_DOWNLOAD_API__: (href: string) => Promise<void>;
