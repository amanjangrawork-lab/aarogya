import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // The app uses Tailwind v4's PostCSS plugin, which Vitest's Vite build cannot load.
  // Tests are logic-only and never need CSS processing, so PostCSS is disabled here.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/__tests__/**", "src/lib/types.ts"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
