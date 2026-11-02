import os from "node:os";
const provider = process.env.TSAAT_DATA_PROVIDER ?? "sql";
if (!["sql", "json"].includes(provider)) throw new Error("TSAAT_DATA_PROVIDER must be sql or json.");
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [os.hostname().toLowerCase()],
  distDir: provider === "json" ? ".next-nosql" : ".next-sql",
  env: { NEXT_PUBLIC_TSAAT_DATA_PROVIDER: provider }
};
export default nextConfig;
