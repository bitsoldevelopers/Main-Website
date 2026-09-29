import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Integration tests: they write to a real MySQL database, so they are kept
 * out of `npm test` and refuse to run against anything but localhost.
 *
 *   DATABASE_URL=mysql://root@localhost:3306/bitsol_next npm run test:integration
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
