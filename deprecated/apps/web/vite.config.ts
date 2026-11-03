import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true, quoteStyle: "double" }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    fs: { allow: ["../.."] },
    port: 4173,
  },
  test: {
    coverage: {
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/routeTree.gen.ts",
        "src/test/**",
        "src/vite-env.d.ts",
      ],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
    },
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
