import os from "node:os";

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [os.hostname().toLowerCase()]
};

export default nextConfig;
