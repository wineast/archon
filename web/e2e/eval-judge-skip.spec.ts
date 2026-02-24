import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect, type Page } from "@playwright/test"

/**
 * E2E: Judge skip when no expectedOutput.
 *
 * Verifies that the judge is skipped for cases without expectedOutput,
 * and runs normally for cases with expectedOutput.
 *
 * Cases:
 *   1. with_expected    (single) — expectedOutput="4", contains "4"  → judge runs
 *   2. without_expected (single) — no expectedOutput, contains "Paris" → judge skipped
 *
 * Expected:
 *   - Both cases pass assertions
 *   - Case 1 shows "Judge Score" section
 *   - Case 2 shows "Judge skipped"
 */

const TIMESTAMP = Date.now()
const TEST_AGENT_NAME = `E2E Judge Skip ${TIMESTAMP}`
const JUDGE_AGENT_NAME = `E2E Judge Skip Judge ${TIMESTAMP}`

// ── Helpers ──────────────────────────────────────────────

async function waitForStable(page: Page) {
  await page.waitForLoadState("networkidle")
}

async function navigateToAgentBuild(page: Page, agentName: string) {
  const card = page.locator("a", { hasText: agentName })
  await card.waitFor({ state: "visible", timeout: 10_000 })
  // Get the card's href (e.g. /zh/orgSlug/agentSlug/chat) and navigate to build
  const href = await card.getAttribute("href")
  if (!href) throw new Error(`Agent card href not found for "${agentName}"`)
  const buildUrl = href.replace(/\/chat$/, "/build")
  await page.goto(buildUrl)
  await waitForStable(page)
}

function visible(page: Page, testId: string) {
  return page.getByTestId(testId).and(page.locator(":visible"))
}

async function createCase(page: Page, key: string) {
  await visible(page, "btn-new-case").click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await dialog.locator("input").first().fill(key)
  await page.waitForTimeout(300)
  await dialog.getByTestId("btn-create-config").click()
  await expect(dialog).not.toBeVisible({ timeout: 5_000 })
  await page.waitForTimeout(500)
}

async function addAssertion(page: Page, type: string, value: string) {
  await visible(page, "btn-add-assertion").click()
  await page.waitForTimeout(200)

  if (type !== "contains") {
    const assertionSelectors = page.getByTestId("select-assertion-type").and(page.locator(":visible"))
    await assertionSelectors.last().click()
    await page.waitForTimeout(200)
    const typeLabels: Record<string, string> = {
      contains: "Contains",
      regex: "Regex",
    }
    await page.getByRole("option", { name: typeLabels[type] }).click()
    await page.waitForTimeout(200)
  }

  if (value) {
    const inputs = visible(page, "input-assertion-value")
    await inputs.last().fill(value)
  }
}

async function saveCase(page: Page) {
  await visible(page, "btn-save").click()
  await page.waitForTimeout(1_000)
}

// ── Test ──────────────────────────────────────────────

test.describe("Eval Judge Skip", () => {
  test("judge 跳过无 expectedOutput 的 case", async ({ page }) => {
    await setupClerkTestingToken({ page })

    // ── Step 1: 登录 ──
    await test.step("登录", async () => {
      await page.goto("/")
      await waitForStable(page)
      await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
    })

    // ── Step 2: 创建测试 Agent ──
    await test.step("创建测试 Agent", async () => {
      await page.getByTestId("btn-create-agent").click()
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible({ timeout: 5_000 })
      await dialog.locator("#agent-name").fill(TEST_AGENT_NAME)
      await page.waitForTimeout(300)
      await dialog.getByTestId("btn-submit-agent").click()
      await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    })

    // ── Step 3: 配置 DeepSeek API Key ──
    await test.step("配置 DeepSeek API Key", async () => {
      await page.getByTestId("link-org-settings").click()
      await waitForStable(page)
      await page.getByTestId("tab-api-keys").click()
      await page.waitForTimeout(500)
      await page.getByTestId("btn-configure-deepseek").click()
      await page.waitForTimeout(300)
      await page.getByTestId("input-api-key").fill(process.env.E2E_DEEPSEEK_API_KEY!)
      await page.getByTestId("btn-save-api-key").click()
      await page.waitForTimeout(1_000)
      await expect(page.getByTestId("api-key-row-deepseek")).not.toContainText("未配置", { timeout: 5_000 })
    })

    // ── Step 4: 测试 Agent → Model Config ──
    await test.step("配置测试 Agent Model Config", async () => {
      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, TEST_AGENT_NAME)
      await page.getByTestId("tab-model-config").click()
      await page.waitForTimeout(500)

      await visible(page, "btn-new-model-config").click()
      const mcDialog = page.getByRole("dialog")
      await expect(mcDialog).toBeVisible({ timeout: 5_000 })
      await mcDialog.locator("input").first().fill("deepseek_chat")
      await page.waitForTimeout(300)
      await mcDialog.getByTestId("btn-create-config").click()
      await expect(mcDialog).not.toBeVisible({ timeout: 5_000 })
      await page.waitForTimeout(500)

      await visible(page, "combobox-model").click()
      await page.waitForTimeout(300)
      await page.locator("input[placeholder*='Search']").fill("deepseek-v3")
      await page.waitForTimeout(500)
      await page.locator("[cmdk-item]").first().click()
      await page.waitForTimeout(500)
      await visible(page, "btn-save").click()
      await page.waitForTimeout(1_000)
      await visible(page, "switch-activate").click()
      await page.waitForTimeout(1_000)
    })

    // ── Step 5: 创建 Judge Agent ──
    await test.step("创建 Judge Agent", async () => {
      await page.goto("/")
      await waitForStable(page)
      await page.getByTestId("btn-create-agent").click()
      const judgeDialog = page.getByRole("dialog")
      await expect(judgeDialog).toBeVisible({ timeout: 5_000 })
      await judgeDialog.locator("#agent-name").fill(JUDGE_AGENT_NAME)
      await page.waitForTimeout(300)
      await judgeDialog.getByTestId("btn-submit-agent").click()
      await expect(judgeDialog).not.toBeVisible({ timeout: 10_000 })
    })

    // ── Step 6: Judge Agent → Model Config ──
    await test.step("配置 Judge Agent Model Config", async () => {
      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, JUDGE_AGENT_NAME)
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

      await visible(page, "combobox-model").click()
      await page.waitForTimeout(300)
      await page.locator("input[placeholder*='Search']").fill("deepseek-v3")
      await page.waitForTimeout(500)
      await page.locator("[cmdk-item]").first().click()
      await page.waitForTimeout(500)
      await visible(page, "btn-save").click()
      await page.waitForTimeout(1_000)
      await visible(page, "switch-activate").click()
      await page.waitForTimeout(1_000)
    })

    // ── Step 7: Judge Agent → Judge Config ──
    await test.step("配置 Judge Config", async () => {
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

      await visible(page, "btn-add-dimension").click()
      await page.waitForTimeout(300)
      await page.locator("input[placeholder='key']:visible").fill("accuracy")
      await page.locator("input[placeholder='Label']:visible").fill("Accuracy")
      await page.locator("input[placeholder='Weight']:visible").fill("")
      await page.locator("input[placeholder='Weight']:visible").fill("1")
      await page.waitForTimeout(300)
      await visible(page, "btn-save").click()
      await page.waitForTimeout(1_000)
      await visible(page, "switch-activate").click()
      await page.waitForTimeout(1_000)
    })

    // ── Step 8: 回到测试 Agent → Eval Tab ──
    await test.step("进入 Eval 页面", async () => {
      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, TEST_AGENT_NAME)
      await page.getByTestId("tab-eval").click()
      await page.waitForTimeout(500)
    })

    // ── Step 9: 创建 Case 1 — 有 expectedOutput ──
    await test.step("创建有 expectedOutput 的 case", async () => {
      await createCase(page, "with_expected")
      await visible(page, "textarea-case-input").fill("What is 2+2? Please answer with just the number.")
      await visible(page, "textarea-expected-output").fill("4")
      await addAssertion(page, "contains", "4")
      await saveCase(page)
    })

    // ── Step 10: 创建 Case 2 — 无 expectedOutput ──
    await test.step("创建无 expectedOutput 的 case", async () => {
      await createCase(page, "without_expected")
      await visible(page, "textarea-case-input").fill("What is the capital of France? Answer in one word.")
      // 不填 expectedOutput
      await addAssertion(page, "regex", "Paris")
      await saveCase(page)
    })

    // ── Step 11: Run All ──
    await test.step("Run All 并等待完成", async () => {
      await visible(page, "btn-eval-results").click()
      await page.waitForTimeout(500)

      await visible(page, "btn-run-all").click()
      const runDialog = page.getByRole("dialog")
      await expect(runDialog).toBeVisible({ timeout: 5_000 })

      await page.getByTestId("select-judge-agent").click()
      await page.waitForTimeout(500)
      await page.getByRole("option", { name: new RegExp(JUDGE_AGENT_NAME) }).click()
      await page.waitForTimeout(500)

      await page.getByTestId("btn-confirm-run").click()
      await expect(runDialog).not.toBeVisible({ timeout: 10_000 })

      // 等待完成
      await expect(page.getByTestId("run-pass-rate").first()).toBeVisible({ timeout: 180_000 })
    })

    // ── Step 12: 验证结果 ──
    await test.step("验证 judge 行为", async () => {
      // run-pass-rate 可见说明 run 已完成
      // useEffect 自动设置 expandedRunId 但不 fetch detail
      // 先点击折叠（toggle off），再点击展开（toggle on + fetch detail）
      const passRate = page.getByTestId("run-pass-rate").first()
      await passRate.click() // 折叠
      await page.waitForTimeout(500)
      await passRate.click() // 展开 + 加载 detail
      await page.waitForTimeout(2_000)

      // 找到两个 result card
      const resultCards = page.getByTestId("result-card")
      await expect(resultCards).toHaveCount(2, { timeout: 15_000 })

      // 找到有 expectedOutput 的 case — 应该有 Judge Score
      const withExpectedCard = resultCards.filter({ has: page.getByTestId("result-case-name").filter({ hasText: "With Expected" }) })
      await expect(withExpectedCard.getByTestId("judge-score-section")).toBeVisible({ timeout: 5_000 })

      // 找到无 expectedOutput 的 case — 应该显示 Judge skipped
      const withoutExpectedCard = resultCards.filter({ has: page.getByTestId("result-case-name").filter({ hasText: "Without Expected" }) })
      await expect(withoutExpectedCard.getByTestId("judge-skipped")).toBeVisible({ timeout: 5_000 })
      await expect(withoutExpectedCard.getByTestId("judge-score-section")).not.toBeVisible()
    })
  })
})
