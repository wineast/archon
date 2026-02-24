import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"
import path from "path"
import fs from "fs"

// Load env files (same order as Next.js)
dotenv.config({ path: path.resolve(__dirname, ".env.local") })
dotenv.config({ path: path.resolve(__dirname, ".env.development.local") })

// Worktree-aware port: read from .worktree/meta.json, fallback to 3000
function getDevPort(): number {
  try {
    const meta = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../.worktree/meta.json"), "utf8")
    )
    return meta.dev
  } catch {
    return 3000
  }
}

const port = getDevPort()
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "authenticated",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".clerk/user.json",
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
