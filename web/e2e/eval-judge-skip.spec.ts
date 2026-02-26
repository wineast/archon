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

const TAG = "[judge-skip]"
const log = (...args: unknown[]) => console.log(TAG, ...args)

// ── Helpers ──────────────────────────────────────────────

async function waitForStable(page: Page) {
  await page.waitForLoadState("networkidle")
}

async function navigateToAgentBuild(page: Page, agentName: string) {
  const card = page.locator("a", { hasText: agentName })
  await card.waitFor({ state: "visible", timeout: 10_000 })
  const href = await card.getAttribute("href")
  if (!href) throw new Error(`Agent card href not found for "${agentName}"`)
  const buildUrl = href.replace(/\/chat$/, "/build")
  log(`navigateToAgentBuild → ${buildUrl}`)
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

    await test.step("登录", async () => {
      log("打开首页")
      await page.goto("/")
      await waitForStable(page)
      await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
      log("登录成功，header 可见")
    })

    await test.step("创建测试 Agent", async () => {
      log(`创建测试 Agent: ${TEST_AGENT_NAME}`)
      await page.getByTestId("btn-create-agent").click()
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible({ timeout: 5_000 })
      await dialog.locator("#agent-name").fill(TEST_AGENT_NAME)
      await page.waitForTimeout(300)
      await dialog.getByTestId("btn-submit-agent").click()
      await expect(dialog).not.toBeVisible({ timeout: 10_000 })
      log("测试 Agent 创建完成")
    })

    await test.step("配置 DeepSeek API Key", async () => {
      log("进入组织设置 → API Keys")
      await page.getByTestId("link-org-settings").click()
      await waitForStable(page)
      await page.getByTestId("tab-api-keys").click()
      await page.waitForTimeout(500)

      const keyRow = page.getByTestId("api-key-row-deepseek")
      const keyText = await keyRow.textContent()
      if (keyText?.includes("未配置")) {
        await page.getByTestId("btn-configure-deepseek").click()
        await page.waitForTimeout(300)
        log("填入 DeepSeek API Key")
        await page.getByTestId("input-api-key").fill(process.env.E2E_DEEPSEEK_API_KEY!)
        await page.getByTestId("btn-save-api-key").click()
        await page.waitForTimeout(1_000)
        await expect(keyRow).not.toContainText("未配置", { timeout: 5_000 })
        log("API Key 保存成功")
      } else {
        log("DeepSeek API Key 已配置，跳过")
      }
    })

    await test.step("配置测试 Agent Model Config", async () => {
      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, TEST_AGENT_NAME)
      log("进入 Model Config tab")
      await page.getByTestId("tab-model-config").click()
      await page.waitForTimeout(500)

      log("创建 model config: deepseek_chat")
      await visible(page, "btn-new-model-config").click()
      const mcDialog = page.getByRole("dialog")
      await expect(mcDialog).toBeVisible({ timeout: 5_000 })
      await mcDialog.locator("input").first().fill("deepseek_chat")
      await page.waitForTimeout(300)
      await mcDialog.getByTestId("btn-create-config").click()
      await expect(mcDialog).not.toBeVisible({ timeout: 5_000 })
      await page.waitForTimeout(500)

      log("选择 deepseek-v3 模型")
      await visible(page, "combobox-model").click()
      await page.waitForTimeout(300)
      await page.locator("input[placeholder*='Search']").fill("deepseek-v3")
      await page.waitForTimeout(500)
      await page.locator("[cmdk-item]").first().click()
      await page.waitForTimeout(500)
      await visible(page, "btn-save").click()
      await page.waitForTimeout(1_000)
      log("激活 model config")
      await visible(page, "switch-activate").click()
      await page.waitForTimeout(1_000)
    })

    await test.step("创建 Judge Agent", async () => {
      log(`创建 Judge Agent: ${JUDGE_AGENT_NAME}`)
      await page.goto("/")
      await waitForStable(page)
      await page.getByTestId("btn-create-agent").click()
      const judgeDialog = page.getByRole("dialog")
      await expect(judgeDialog).toBeVisible({ timeout: 5_000 })
      await judgeDialog.locator("#agent-name").fill(JUDGE_AGENT_NAME)
      await page.waitForTimeout(300)
      await judgeDialog.getByTestId("btn-submit-agent").click()
      await expect(judgeDialog).not.toBeVisible({ timeout: 10_000 })
      log("Judge Agent 创建完成")
    })

    await test.step("配置 Judge Agent Model Config", async () => {
      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, JUDGE_AGENT_NAME)
      log("进入 Judge Agent Model Config tab")
      await page.getByTestId("tab-model-config").click()
      await page.waitForTimeout(500)

      log("创建 model config: deepseek_judge")
      await visible(page, "btn-new-model-config").click()
      const jmcDialog = page.getByRole("dialog")
      await expect(jmcDialog).toBeVisible({ timeout: 5_000 })
      await jmcDialog.locator("input").first().fill("deepseek_judge")
      await page.waitForTimeout(300)
      await jmcDialog.getByTestId("btn-create-config").click()
      await expect(jmcDialog).not.toBeVisible({ timeout: 5_000 })
      await page.waitForTimeout(500)

      log("选择 deepseek-v3 模型")
      await visible(page, "combobox-model").click()
      await page.waitForTimeout(300)
      await page.locator("input[placeholder*='Search']").fill("deepseek-v3")
      await page.waitForTimeout(500)
      await page.locator("[cmdk-item]").first().click()
      await page.waitForTimeout(500)
      await visible(page, "btn-save").click()
      await page.waitForTimeout(1_000)
      log("激活 Judge model config")
      await visible(page, "switch-activate").click()
      await page.waitForTimeout(1_000)
    })

    await test.step("配置 Judge Config", async () => {
      log("进入 Judge tab")
      await page.getByTestId("tab-judge").click()
      await page.waitForTimeout(500)

      log("创建 judge config: accuracy")
      await visible(page, "btn-new-judge-config").click()
      const jcDialog = page.getByRole("dialog")
      await expect(jcDialog).toBeVisible({ timeout: 5_000 })
      await jcDialog.locator("input").first().fill("accuracy")
      await page.waitForTimeout(300)
      await jcDialog.getByTestId("btn-create-config").click()
      await expect(jcDialog).not.toBeVisible({ timeout: 5_000 })
      await page.waitForTimeout(500)

      log("添加 dimension: accuracy/Accuracy/1")
      await visible(page, "btn-add-dimension").click()
      await page.waitForTimeout(300)
      await page.locator("input[placeholder='key']:visible").fill("accuracy")
      await page.locator("input[placeholder='Label']:visible").fill("Accuracy")
      await page.locator("input[placeholder='Weight']:visible").fill("")
      await page.locator("input[placeholder='Weight']:visible").fill("1")
      await page.waitForTimeout(300)
      await visible(page, "btn-save").click()
      await page.waitForTimeout(1_000)
      log("激活 judge config")
      await visible(page, "switch-activate").click()
      await page.waitForTimeout(1_000)
    })

    await test.step("进入 Eval 页面", async () => {
      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, TEST_AGENT_NAME)
      log("进入 Eval tab")
      await page.getByTestId("tab-eval").click()
      await page.waitForTimeout(500)
    })

    await test.step("创建有 expectedOutput 的 case", async () => {
      log("创建 case: with_expected (input=2+2, expected=4, assertion=contains 4)")
      await createCase(page, "with_expected")
      await visible(page, "textarea-case-input").fill("What is 2+2? Please answer with just the number.")
      await visible(page, "textarea-expected-output").fill("4")
      await addAssertion(page, "contains", "4")
      await saveCase(page)
      log("case with_expected 保存完成")
    })

    await test.step("创建无 expectedOutput 的 case", async () => {
      log("创建 case: without_expected (input=capital of France, 无 expectedOutput, assertion=regex Paris)")
      await createCase(page, "without_expected")
      await visible(page, "textarea-case-input").fill("What is the capital of France? Answer in one word.")
      await addAssertion(page, "regex", "Paris")
      await saveCase(page)
      log("case without_expected 保存完成")
    })

    await test.step("Run All 并等待完成", async () => {
      log("切换到 Results 面板")
      await visible(page, "btn-eval-results").click()
      await page.waitForTimeout(500)

      log("点击 Run All")
      await visible(page, "btn-run-all").click()
      const runDialog = page.getByRole("dialog")
      await expect(runDialog).toBeVisible({ timeout: 5_000 })

      log(`选择 Judge Agent: ${JUDGE_AGENT_NAME}`)
      await page.getByTestId("select-judge-agent").click()
      await page.waitForTimeout(500)
      await page.getByRole("option", { name: new RegExp(JUDGE_AGENT_NAME) }).click()
      await page.waitForTimeout(500)

      log("确认运行")
      await page.getByTestId("btn-confirm-run").click()
      await expect(runDialog).not.toBeVisible({ timeout: 10_000 })

      log("等待 run 完成（最长 180s）...")
      await expect(page.getByTestId("run-pass-rate").first()).toBeVisible({ timeout: 180_000 })
      const passRateText = await page.getByTestId("run-pass-rate").first().textContent()
      log(`run 完成，pass rate: ${passRateText}`)
    })

    await test.step("验证 judge 行为", async () => {
      // 折叠再展开以触发 detail 加载
      log("折叠再展开以加载 detail")
      const batchHeader = page.getByTestId("run-pass-rate").first().locator("../..")
      await batchHeader.click()
      await page.waitForTimeout(500)
      await batchHeader.click()

      log("等待 result cards 加载")
      const resultCards = visible(page, "result-card")
      await expect(resultCards.first()).toBeVisible({ timeout: 15_000 })
      await expect(resultCards).toHaveCount(2, { timeout: 15_000 })
      const count = await resultCards.count()
      log(`result cards 数量: ${count}`)

      log("验证 with_expected case → judge-score-section 可见")
      const withExpectedCard = resultCards.filter({ has: page.getByTestId("result-case-name").filter({ hasText: "With Expected" }) })
      await expect(withExpectedCard.getByTestId("judge-score-section")).toBeVisible({ timeout: 15_000 })

      log("验证 without_expected case → judge-skipped 可见")
      const withoutExpectedCard = resultCards.filter({ has: page.getByTestId("result-case-name").filter({ hasText: "Without Expected" }) })
      await expect(withoutExpectedCard.getByTestId("judge-skipped")).toBeVisible({ timeout: 15_000 })
      await expect(withoutExpectedCard.getByTestId("judge-score-section")).not.toBeVisible()
      log("judge 行为验证通过 ✓")
    })

    await test.step("报告页验证", async () => {
      log("打开报告页")
      const [newPage] = await Promise.all([
        page.context().waitForEvent("page"),
        page.getByTestId("btn-eval-report").first().click(),
      ])
      await newPage.waitForLoadState("networkidle")
      await expect(newPage.getByTestId("eval-report-page")).toBeVisible({ timeout: 15_000 })
      log("报告页已加载")

      await expect(newPage.getByTestId("report-pass-rate")).toHaveText(/2\/2/)
      log("报告页 pass rate 验证通过")
      const reportCards = newPage.getByTestId("result-card")
      await expect(reportCards).toHaveCount(2, { timeout: 10_000 })
      log("报告页 result cards 数量验证通过")
      await newPage.close()
    })
  })
})
