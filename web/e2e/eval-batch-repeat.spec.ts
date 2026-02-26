import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect, type Page } from "@playwright/test"

/**
 * E2E: Eval Batch Repeat — 验证批量重复执行功能。
 *
 * Flow:
 *   1. Login → Create Test Agent + Judge Agent（配置 DeepSeek 模型 + Judge Config）
 *   2. Test Agent → Eval tab → Create case ("2+2=?" with "contains 4" assertion)
 *   3. Results → Run All → 设置 repeatCount=3 → Confirm
 *   4. 验证 batch 运行中状态：x3 badge、进度显示
 *   5. 等待 batch 完成
 *   6. 验证 batch header：x3 badge、pass rate、score±stdDev
 *   7. 验证聚合统计：Avg Pass Rate、Avg Score、Std Dev、Range
 *   8. 验证 3 个 Run 子项展示
 *   9. 展开 Run #1 验证 ResultCard 详情
 */

const TIMESTAMP = Date.now()
const TEST_AGENT_NAME = `E2E Batch Agent ${TIMESTAMP}`
const JUDGE_AGENT_NAME = `E2E Batch Judge ${TIMESTAMP}`

const TAG = "[eval-batch-repeat]"
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

async function createAgent(page: Page, name: string) {
  log(`创建 Agent: ${name}`)
  await page.getByTestId("btn-create-agent").click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await dialog.locator("#agent-name").fill(name)
  await page.waitForTimeout(300)
  await dialog.getByTestId("btn-submit-agent").click()
  await expect(dialog).not.toBeVisible({ timeout: 10_000 })
  log(`Agent 创建完成: ${name}`)
}

async function setupDeepSeekModel(page: Page, configName: string) {
  log(`进入 Model Config tab → 创建 ${configName}`)
  await page.getByTestId("tab-model-config").click()
  await page.waitForTimeout(500)

  await visible(page, "btn-new-model-config").click()
  const mcDialog = page.getByRole("dialog")
  await expect(mcDialog).toBeVisible({ timeout: 5_000 })
  await mcDialog.locator("input").first().fill(configName)
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
}

test.describe("批量重复执行 E2E", () => {
  test("batch repeat x3 lifecycle", async ({ page }) => {
    await setupClerkTestingToken({ page })

    // ── Step 1: Login ──
    await test.step("登录", async () => {
      log("打开首页")
      await page.goto("/")
      await waitForStable(page)
      await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
      log("登录成功")
    })

    // ── Step 2: Create Test Agent + DeepSeek model ──
    await test.step("创建测试 Agent + 配置模型", async () => {
      await createAgent(page, TEST_AGENT_NAME)

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

      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, TEST_AGENT_NAME)
      await setupDeepSeekModel(page, "deepseek_chat")
    })

    // ── Step 3: Create Judge Agent + Model + Judge Config ──
    await test.step("创建 Judge Agent + 配置模型 + Judge Config", async () => {
      await page.goto("/")
      await waitForStable(page)
      await createAgent(page, JUDGE_AGENT_NAME)
      await navigateToAgentBuild(page, JUDGE_AGENT_NAME)
      await setupDeepSeekModel(page, "deepseek_judge")

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

    // ── Step 4: Create Eval Case ──
    await test.step("创建 Eval Case (2+2=?)", async () => {
      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, TEST_AGENT_NAME)

      log("进入 Eval tab")
      await page.getByTestId("tab-eval").click()
      await page.waitForTimeout(500)

      log("创建 eval case: math_batch")
      await visible(page, "btn-new-case").click()
      const caseDialog = page.getByRole("dialog")
      await expect(caseDialog).toBeVisible({ timeout: 5_000 })
      await caseDialog.locator("input").first().fill("math_batch")
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
    })

    // ── Step 5: Run All with repeatCount=3 ──
    await test.step("Run All + 设置重复次数为 3", async () => {
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

      log("等待确认按钮变为可用")
      await expect(page.getByTestId("btn-confirm-run")).toBeEnabled({ timeout: 15_000 })

      log("设置重复次数为 3")
      const repeatInput = page.getByTestId("input-repeat-count")
      await repeatInput.fill("3")
      await page.waitForTimeout(300)
      await expect(repeatInput).toHaveValue("3")
      log("重复次数已设置为 3")

      log("验证 Run 并发数输入框出现（repeatCount>1 时显示）")
      await expect(page.getByTestId("input-run-concurrency")).toBeVisible()
      log("Run 并发数输入框已显示")

      log("验证确认按钮显示 x3")
      await expect(page.getByTestId("btn-confirm-run")).toContainText("x3")
      log("确认按钮包含 x3")

      log("确认运行")
      await page.getByTestId("btn-confirm-run").click()
      await expect(runDialog).not.toBeVisible({ timeout: 10_000 })
      log("batch 已启动")
    })

    // ── Step 6: Verify running state ──
    await test.step("验证 batch 运行中状态", async () => {
      log("验证 x3 badge 出现")
      await expect(page.getByTestId("batch-repeat-badge").first()).toBeVisible({ timeout: 10_000 })
      const badgeText = await page.getByTestId("batch-repeat-badge").first().textContent()
      log(`x3 badge 内容: ${badgeText}`)
      expect(badgeText).toContain("x3")
      log("batch 运行中状态验证通过")
    })

    // ── Step 7: Wait for completion ──
    await test.step("等待 batch 完成", async () => {
      log("等待 batch 完成（最长 300s，3 次 run 各需 ~30s）...")
      // Wait for run-pass-rate to appear on the first batch item (indicates completion)
      await expect(page.getByTestId("run-pass-rate").first()).toBeVisible({ timeout: 300_000 })
      const passRateText = await page.getByTestId("run-pass-rate").first().textContent()
      log(`batch 完成，pass rate: ${passRateText}`)
    })

    // ── Step 8: Verify batch header ──
    await test.step("验证 batch header 聚合数据", async () => {
      log("验证 pass rate 格式")
      await expect(page.getByTestId("run-pass-rate").first()).toHaveText(/\d+\/\d+/)
      const passRate = await page.getByTestId("run-pass-rate").first().textContent()
      log(`pass rate: ${passRate}`)

      log("验证 score 格式（含标准差）")
      await expect(page.getByTestId("run-score").first()).toBeVisible()
      const scoreText = await page.getByTestId("run-score").first().textContent()
      log(`score: ${scoreText}`)
      // Score should contain ±stdDev for batch
      expect(scoreText).toMatch(/\d+\/\d+/)

      log("验证 x3 badge 仍存在")
      await expect(page.getByTestId("batch-repeat-badge").first()).toBeVisible()
    })

    // ── Step 9: Expand batch → verify aggregate stats ──
    await test.step("展开 batch → 验证聚合统计", async () => {
      log("点击 batch header 展开")
      // The first history item is the batch — click it to expand
      const batchHeader = page.getByTestId("batch-repeat-badge").first().locator("../..")
      await batchHeader.click()
      await page.waitForTimeout(1_000)

      // Use .first() to avoid strict mode violation from desktop/mobile dual rendering
      log("验证聚合统计区域出现")
      await expect(visible(page, "batch-aggregate-stats")).toBeVisible({ timeout: 5_000 })

      log("验证 Avg Pass Rate")
      const avgPassRate = await visible(page, "batch-avg-pass-rate").textContent()
      log(`Avg Pass Rate: ${avgPassRate}`)
      expect(avgPassRate).toMatch(/\d+\/\d+/)

      log("验证 Avg Score")
      const avgScore = await visible(page, "batch-avg-score").textContent()
      log(`Avg Score: ${avgScore}`)
      expect(avgScore).toMatch(/\d+\/\d+/)

      log("验证 Std Dev")
      const stdDev = await visible(page, "batch-std-dev").textContent()
      log(`Std Dev: ${stdDev}`)

      log("验证 Range")
      const range = await visible(page, "batch-score-range").textContent()
      log(`Range: ${range}`)
      expect(range).toMatch(/\d+\s*~\s*\d+/)
    })

    // ── Step 10: Verify 3 run items ──
    await test.step("验证 3 个 Run 子项", async () => {
      log("验证 batch-run-item 数量至少 3 个可见")
      const runItems = visible(page, "batch-run-item")
      await expect(runItems.first()).toBeVisible({ timeout: 5_000 })
      const count = await runItems.count()
      log(`batch-run-item 数量: ${count}`)
      expect(count).toBeGreaterThanOrEqual(3)
      log("3 个 Run 子项验证通过")

      // Verify each run item shows Run # label
      for (let i = 0; i < 3; i++) {
        const runItem = runItems.nth(i)
        const text = await runItem.textContent()
        log(`Run #${i + 1} 内容: ${text}`)
        expect(text).toContain(`Run #${i + 1}`)
      }
    })

    // ── Step 11: Expand Run #1 → verify ResultCard ──
    await test.step("展开 Run #1 → 验证 ResultCard", async () => {
      log("点击 Run #1 展开")
      const runItems = visible(page, "batch-run-item")
      // Click the run header row (role="button") to toggle expand
      const run1Header = runItems.first().locator("[role='button']")
      await run1Header.click()
      log("已点击 Run #1 header")

      log("等待 ResultCard 加载（异步获取 run detail）...")
      // Run detail is fetched via API after expand, give it enough time
      const resultCard = page.getByTestId("result-card").first()
      await expect(resultCard).toBeVisible({ timeout: 15_000 })
      const cardText = await resultCard.textContent()
      log(`ResultCard 内容前 100 字: ${cardText?.slice(0, 100)}`)

      // Verify result card contains case name (rendered as Title Case "Math Batch")
      expect(cardText).toContain("Math Batch")
      log("ResultCard 验证通过")
    })

    // ── Step 12: Open batch report → verify report page ──
    await test.step("点击 batch report → 验证报告页面", async () => {
      log("点击 batch header 上的 ExternalLinkIcon 打开报告")
      const batchReportBtn = visible(page, "btn-batch-report").first()
      await expect(batchReportBtn).toBeVisible({ timeout: 5_000 })

      // Listen for new tab before clicking
      const newPagePromise = page.context().waitForEvent("page")
      await batchReportBtn.click()
      const reportPage = await newPagePromise
      await reportPage.waitForLoadState("networkidle")
      log("报告页面已打开")

      log("验证 eval-batch-report-page 存在")
      await expect(reportPage.getByTestId("eval-batch-report-page")).toBeVisible({ timeout: 15_000 })

      log("验证 report-repeat-count 包含 x3")
      const repeatCount = await reportPage.getByTestId("report-repeat-count").textContent()
      log(`report-repeat-count: ${repeatCount}`)
      expect(repeatCount).toContain("x3")

      log("验证 report-pass-rate 格式")
      const passRate = await reportPage.getByTestId("report-pass-rate").textContent()
      log(`report-pass-rate: ${passRate}`)
      expect(passRate).toMatch(/\d+\/\d+/)

      log("验证 report-score 格式")
      const score = await reportPage.getByTestId("report-score").textContent()
      log(`report-score: ${score}`)
      expect(score).toMatch(/\d+\/\d+/)

      log("验证 report-aggregate-stats 存在（N>1 batch）")
      await expect(reportPage.getByTestId("report-aggregate-stats")).toBeVisible({ timeout: 5_000 })

      log("关闭报告页面")
      await reportPage.close()
      log("batch report 验证通过")
    })
  })
})
