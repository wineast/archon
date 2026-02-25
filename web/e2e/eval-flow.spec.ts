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

const TAG = "[eval-flow]"
const log = (...args: unknown[]) => console.log(TAG, ...args)

// ── Helpers ──────────────────────────────────────────────

async function waitForStable(page: Page) {
  await page.waitForLoadState("networkidle")
}

/** Navigate to agent build page by extracting href from card */
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

    log("打开首页")
    await page.goto("/")
    await waitForStable(page)
    await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
    log("登录成功")

    log(`创建测试 Agent: ${TEST_AGENT_NAME}`)
    await page.getByTestId("btn-create-agent").click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await dialog.locator("#agent-name").fill(TEST_AGENT_NAME)
    await page.waitForTimeout(300)
    await dialog.getByTestId("btn-submit-agent").click()
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    log("测试 Agent 创建完成")

    log("进入组织设置 → API Keys")
    await page.getByTestId("link-org-settings").click()
    await waitForStable(page)
    await page.getByTestId("tab-api-keys").click()
    await page.waitForTimeout(500)
    await page.getByTestId("btn-configure-deepseek").click()
    await page.waitForTimeout(300)
    log("填入 DeepSeek API Key")
    await page.getByTestId("input-api-key").fill(process.env.E2E_DEEPSEEK_API_KEY!)
    await page.getByTestId("btn-save-api-key").click()
    await page.waitForTimeout(1_000)
    await expect(page.getByTestId("api-key-row-deepseek")).not.toContainText("未配置", { timeout: 5_000 })
    log("API Key 保存成功")

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

    await page.goto("/")
    await waitForStable(page)
    await navigateToAgentBuild(page, TEST_AGENT_NAME)
    log("进入 Eval tab")
    await page.getByTestId("tab-eval").click()
    await page.waitForTimeout(500)

    log("创建 eval case: math_basic (contains 4)")
    await visible(page, "btn-new-case").click()
    const caseDialog = page.getByRole("dialog")
    await expect(caseDialog).toBeVisible({ timeout: 5_000 })
    await caseDialog.locator("input").first().fill("math_basic")
    await page.waitForTimeout(300)
    await caseDialog.getByTestId("btn-create-config").click()
    await expect(caseDialog).not.toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(500)

    await visible(page, "textarea-case-input").fill("What is 2+2? Please answer with just the number.")
    await visible(page, "textarea-expected-output").fill("4")
    await visible(page, "btn-add-assertion").click()
    await page.waitForTimeout(300)
    await visible(page, "input-assertion-value").fill("4")
    await visible(page, "btn-save").click()
    await page.waitForTimeout(1_000)
    log("case 保存完成")

    log("切换到 Results 面板 → Run All")
    await visible(page, "btn-eval-results").click()
    await page.waitForTimeout(500)
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
    await expect(page.getByTestId("run-pass-rate").first()).toHaveText(/1\/1/)
    const scoreText = await page.getByTestId("run-score").first().textContent()
    log(`score: ${scoreText}`)
    await expect(page.getByTestId("run-score").first()).toHaveText(/[1-9]\d?\/10/)

    log("打开报告页")
    const [newPage] = await Promise.all([
      page.context().waitForEvent("page"),
      page.getByTestId("btn-eval-report").first().click(),
    ])
    await newPage.waitForLoadState("networkidle")
    await expect(newPage.getByTestId("eval-report-page")).toBeVisible({ timeout: 15_000 })
    log("报告页已加载")

    await expect(newPage.getByTestId("report-pass-rate")).toHaveText(/1\/1/)
    log("报告页 pass rate 验证通过")
    await expect(newPage.getByTestId("report-score")).toHaveText(/\d+\/10/)
    log("报告页 score 验证通过")
    const reportCards = newPage.getByTestId("result-card")
    await expect(reportCards).toHaveCount(1, { timeout: 10_000 })
    log("报告页 result cards 数量验证通过")
    await newPage.close()
  })
})
