import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests", "server-only.ts")
    }
  },
  test: {
    globals: true,
    maxWorkers: 4,
    testTimeout: 30000,
    hookTimeout: 30000,
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
