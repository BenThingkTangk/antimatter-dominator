import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Stub Akamai EdgeWorker built-in modules for test environment
      "http-request":    path.resolve("__mocks__/http-request.ts"),
      "create-response": path.resolve("__mocks__/create-response.ts"),
      "streams":         path.resolve("__mocks__/streams.ts"),
      "log":             path.resolve("__mocks__/log.ts"),
      "cookies":         path.resolve("__mocks__/cookies.ts"),
    },
  },
  test: {
    root: ".",
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
