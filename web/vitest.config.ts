import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
/** Vite plugin: import *.md files as raw strings (matching next.config raw-loader). */
function rawMdPlugin() {
  return {
    name: "raw-md",
    transform(_code: string, id: string) {
      if (id.endsWith(".md")) {
        const fs = require("fs");
        const content = fs.readFileSync(id, "utf-8");
        return { code: `export default ${JSON.stringify(content)};`, map: null };
      }
    },
  };
}

export default defineConfig({
  plugins: [rawMdPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    globals: true,
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/__tests__/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.stories.*', 'src/**/*.mdx'],
        }
      },
      {
        extends: true,
        plugins: [
        // The plugin will run tests for the stories defined in your Storybook config
        // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
        storybookTest({
          configDir: path.join(dirname, '.storybook')
        })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{
              browser: 'chromium'
            }]
          },
          setupFiles: ['.storybook/vitest.setup.ts']
        }
      }
    ]
  }
});