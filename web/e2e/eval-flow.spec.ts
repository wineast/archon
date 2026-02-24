import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect, type Page } from "@playwright/test"

/**
 * E2E: Full evaluation flow — one continuous test producing a single video.
 *
 * Flow:
 *   1. Login → Agents page
 *   2. Create "E2E Test Agent"
 *   3. Org Settings → Configure DeepSeek API Key
 *   4. E2E Test Agent → Model Config → Create DeepSeek config
 *   5. Home → Create "E2E Judge Agent"
 *   6. Judge Agent → Model Config → Create DeepSeek config
 *   7. Judge Agent → Judge → Create Judge Config (Accuracy dimension)
 *   8. E2E Test Agent → Eval tab
 *   9. Create Eval Case ("2+2=?" with "contains 4" assertion)
 *  10. Results → Run All → Select Judge → Confirm
 *  11. Wait for completion
 *  12. Verify Passed result
 */

const TIMESTAMP = Date.now()
const TEST_AGENT_NAME = `E2E Test Agent ${TIMESTAMP}`
const JUDGE_AGENT_NAME = `E2E Judge Agent ${TIMESTAMP}`

// ── Helpers ──────────────────────────────────────────────

async function waitForStable(page: Page) {
  await page.waitForLoadState("networkidle")
}

/** Open agent card's dropdown menu and click "构建" to enter build page */
async function navigateToAgentBuild(page: Page, agentName: string) {
  // Find the agent card link containing the agent name
  const card = page.locator("a", { hasText: agentName })
  await card.getByTestId("btn-agent-menu").click({ force: true })
  await page.waitForTimeout(300)
  // Click "构建" (build) menu item
  await page.getByTestId("menu-item-build").click()
  await waitForStable(page)
}

/**
 * Build page panels have Desktop/Mobile dual rendering (hidden sm:flex / sm:hidden).
 * In 1440x900 viewport, scope interactions to visible elements only.
 */
function visible(page: Page, testId: string) {
  return page.getByTestId(testId).and(page.locator(":visible"))
}

test.describe("Eval E2E Flow", () => {
  test("full evaluation lifecycle", async ({ page }) => {
    await setupClerkTestingToken({ page })

    // ── Step 1: Login & land on agents page ──
    await page.goto("/")
    await waitForStable(page)
    await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })

    // ── Step 2: Create "E2E Test Agent" ──
    await page.getByTestId("btn-create-agent").click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await dialog.locator("#agent-name").fill(TEST_AGENT_NAME)
    await page.waitForTimeout(300)
    await dialog.getByTestId("btn-submit-agent").click()
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    // Agent created — go to Org Settings directly from homepage
    // ── Step 3: Org Settings → Configure DeepSeek API Key ──
    await page.getByTestId("link-org-settings").click()
    await waitForStable(page)

    // Click "API Keys" tab in settings sidebar
    await page.getByTestId("tab-api-keys").click()
    await page.waitForTimeout(500)

    // Find DeepSeek row and click configure
    await page.getByTestId("btn-configure-deepseek").click()
    await page.waitForTimeout(300)

    // Fill API key & save
    await page.getByTestId("input-api-key").fill(process.env.E2E_DEEPSEEK_API_KEY!)
    await page.getByTestId("btn-save-api-key").click()
    await page.waitForTimeout(1_000)

    // Verify saved — masked key visible
    await expect(page.getByTestId("api-key-row-deepseek")).not.toContainText("未配置", { timeout: 5_000 })

    // ── Step 4: Back to E2E Test Agent → Model Config ──
    await page.goto("/")
    await waitForStable(page)
    await navigateToAgentBuild(page, TEST_AGENT_NAME)

    // Click Model Config tab
    await page.getByTestId("tab-model-config").click()
    await page.waitForTimeout(500)

    // Create new model config
    await visible(page, "btn-new-model-config").click()
    const mcDialog = page.getByRole("dialog")
    await expect(mcDialog).toBeVisible({ timeout: 5_000 })

    // Fill key → auto-generates name
    await mcDialog.locator("input").first().fill("deepseek_chat")
    await page.waitForTimeout(300)
    await mcDialog.getByTestId("btn-create-config").click()
    await expect(mcDialog).not.toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(500)

    // Select DeepSeek model via combobox
    await visible(page, "combobox-model").click()
    await page.waitForTimeout(300)
    await page.locator("input[placeholder*='Search']").fill("deepseek-v3")
    await page.waitForTimeout(500)
    // Click first available deepseek model
    await page.locator("[cmdk-item]").first().click()
    await page.waitForTimeout(500)

    // Save model config
    await visible(page, "btn-save").click()
    await page.waitForTimeout(1_000)

    // Activate model config (new configs default to inactive)
    await visible(page, "switch-activate").click()
    await page.waitForTimeout(1_000)

    // ── Step 5: Home → Create "E2E Judge Agent" ──
    await page.goto("/")
    await waitForStable(page)
    await page.getByTestId("btn-create-agent").click()

    const judgeDialog = page.getByRole("dialog")
    await expect(judgeDialog).toBeVisible({ timeout: 5_000 })
    await judgeDialog.locator("#agent-name").fill(JUDGE_AGENT_NAME)
    await page.waitForTimeout(300)
    await judgeDialog.getByTestId("btn-submit-agent").click()
    await expect(judgeDialog).not.toBeVisible({ timeout: 10_000 })

    // Enter Judge Agent → build page
    await navigateToAgentBuild(page, JUDGE_AGENT_NAME)

    // ── Step 6: Judge Agent → Model Config → DeepSeek ──
    await page.getByTestId("tab-model-config").click()
    await page.waitForTimeout(500)

    await visible(page, "btn-new-model-config").click()
    const jmcDialog = page.getByRole("dialog")
    await expect(jmcDialog).toBeVisible({ timeout: 5_000 })
    await jmcDialog.locator("input").first().fill("deepseek_judge")
    await page.waitForTimeout(300)
    await jmcDialog.getByTestId("btn-create-config").click()
    await expect(jmcDialog).not.toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(500)

    // Select DeepSeek model
    await visible(page, "combobox-model").click()
    await page.waitForTimeout(300)
    await page.locator("input[placeholder*='Search']").fill("deepseek-v3")
    await page.waitForTimeout(500)
    await page.locator("[cmdk-item]").first().click()
    await page.waitForTimeout(500)

    // Save
    await visible(page, "btn-save").click()
    await page.waitForTimeout(1_000)

    // Activate judge's model config
    await visible(page, "switch-activate").click()
    await page.waitForTimeout(1_000)

    // ── Step 7: Judge Agent → Judge tab → Create Judge Config ──
    await page.getByTestId("tab-judge").click()
    await page.waitForTimeout(500)

    await visible(page, "btn-new-judge-config").click()
    const jcDialog = page.getByRole("dialog")
    await expect(jcDialog).toBeVisible({ timeout: 5_000 })
    await jcDialog.locator("input").first().fill("accuracy")
    await page.waitForTimeout(300)
    await jcDialog.getByTestId("btn-create-config").click()
    await expect(jcDialog).not.toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(500)

    // Add a dimension
    await visible(page, "btn-add-dimension").click()
    await page.waitForTimeout(300)

    // Fill dimension: key=accuracy, label=Accuracy, weight=1
    await page.locator("input[placeholder='key']:visible").fill("accuracy")
    await page.locator("input[placeholder='Label']:visible").fill("Accuracy")
    await page.locator("input[placeholder='Weight']:visible").fill("")
    await page.locator("input[placeholder='Weight']:visible").fill("1")
    await page.waitForTimeout(300)

    // Save judge config
    await visible(page, "btn-save").click()
    await page.waitForTimeout(1_000)

    // Activate judge config
    await visible(page, "switch-activate").click()
    await page.waitForTimeout(1_000)

    // ── Step 8: Back to E2E Test Agent → Eval tab ──
    await page.goto("/")
    await waitForStable(page)
    await navigateToAgentBuild(page, TEST_AGENT_NAME)

    await page.getByTestId("tab-eval").click()
    await page.waitForTimeout(500)

    // ── Step 9: Create Eval Case ──
    await visible(page, "btn-new-case").click()
    const caseDialog = page.getByRole("dialog")
    await expect(caseDialog).toBeVisible({ timeout: 5_000 })
    await caseDialog.locator("input").first().fill("math_basic")
    await page.waitForTimeout(300)
    await caseDialog.getByTestId("btn-create-config").click()
    await expect(caseDialog).not.toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(500)

    // Fill case input
    await visible(page, "textarea-case-input").fill("What is 2+2? Please answer with just the number.")

    // Fill expected output
    await visible(page, "textarea-expected-output").fill("4")

    // Add assertion: contains "4"
    await visible(page, "btn-add-assertion").click()
    await page.waitForTimeout(300)

    // The assertion type defaults to "Contains" — fill value
    await visible(page, "input-assertion-value").fill("4")

    // Save the case
    await visible(page, "btn-save").click()
    await page.waitForTimeout(1_000)

    // ── Step 10: Switch to Results → Run All ──
    await visible(page, "btn-eval-results").click()
    await page.waitForTimeout(500)

    // Click Run All
    await visible(page, "btn-run-all").click()

    // RunEvalDialog opens
    const runDialog = page.getByRole("dialog")
    await expect(runDialog).toBeVisible({ timeout: 5_000 })

    // Select Judge Agent via the slot select
    await page.getByTestId("select-judge-agent").click()
    await page.waitForTimeout(500)

    // Click on the Judge Agent option in the dropdown
    await page.getByRole("option", { name: new RegExp(JUDGE_AGENT_NAME) }).click()
    await page.waitForTimeout(500)

    // Confirm run
    await page.getByTestId("btn-confirm-run").click()
    await expect(runDialog).not.toBeVisible({ timeout: 10_000 })

    // ── Step 11 & 12: Wait for eval to complete and verify results ──
    // The run may complete very quickly for simple cases (DeepSeek answers "2+2=?" in seconds).
    // Instead of checking for "Running" state (which may flash too fast), wait directly for results.

    // Wait for the expanded result card to show "Passed" badge — up to 180s for real API call
    await expect(page.getByTestId("badge-passed").first()).toBeVisible({ timeout: 180_000 })

    // Verify summary row: pass rate and score
    await expect(page.getByTestId("run-pass-rate").first()).toHaveText(/1\/1/)
    await expect(page.getByTestId("run-score").first()).toHaveText(/[1-9]\d?\/10/)
  })
})
