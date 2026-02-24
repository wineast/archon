import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect } from "@playwright/test"

test.describe("smoke", () => {
  test("authenticated user sees agents page", async ({ page }) => {
    await setupClerkTestingToken({ page })
    await page.goto("/")

    // Should see the page title
    await expect(page).toHaveTitle(/archon/i)

    // Should see the agents header (means auth succeeded and main page loaded)
    await expect(page.locator("header")).toBeVisible()
  })

  test("navigation to non-existent page shows 404", async ({ page }) => {
    await setupClerkTestingToken({ page })
    await page.goto("/this-page-does-not-exist")

    await expect(page).toHaveTitle(/404/)
  })
})
