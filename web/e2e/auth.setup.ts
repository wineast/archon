import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright"
import { test as setup, expect } from "@playwright/test"
import fs from "fs"

const authFile = ".clerk/user.json"
const MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

function isStorageStateFresh(): boolean {
  try {
    const stat = fs.statSync(authFile)
    return Date.now() - stat.mtimeMs < MAX_AGE_MS
  } catch {
    return false
  }
}

setup("authenticate", async ({ page }) => {
  if (isStorageStateFresh()) {
    // eslint-disable-next-line no-console
    console.log(`[auth.setup] reusing cached ${authFile} (< 30min old)`)
    return
  }

  await setupClerkTestingToken({ page })
  await page.goto("/")

  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: process.env.E2E_CLERK_USER_USERNAME!,
      password: process.env.E2E_CLERK_USER_PASSWORD!,
    },
  })

  // Verify sign-in succeeded
  await expect(page.locator("body")).not.toContainText("Sign in")

  await page.context().storageState({ path: authFile })
})
