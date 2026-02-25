import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect, type Page } from "@playwright/test"

/**
 * E2E: Binary evaluation (0/1 scoring) — verifies that min/max dimension config
 * works end-to-end and score displays as x/1 instead of x/10.
 *
 * Flow:
 *   1. Login → Agents page
 *   2. Create test Agent + configure DeepSeek model
 *   3. Create Judge Agent + configure DeepSeek model
 *   4. Judge Agent → Judge tab → Create binary judge config (pass, min=0, max=1)
 *   5. Test Agent → Eval tab → Create case ("2+2=?" with "contains 4" + expectedOutput)
 *   6. Run All → Select Judge → Confirm
 *   7. Wait for completion → Verify pass rate and score format (x/1)
 */

const TIMESTAMP = Date.now()
const TEST_AGENT_NAME = `E2E Binary Agent ${TIMESTAMP}`
const JUDGE_AGENT_NAME = `E2E Binary Judge ${TIMESTAMP}`

const TAG = "[eval-binary]"
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

test.describe("二元评估 E2E", () => {
  test("binary scoring (0/1) lifecycle", async ({ page }) => {
    await setupClerkTestingToken({ page })

    // ── Step 1: Login ──
    await test.step("登录", async () => {
      log("打开首页")
      await page.goto("/")
      await waitForStable(page)
      await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
      log("登录成功")
    })

    // ── Step 2: Create test Agent + DeepSeek model ──
    await test.step("创建测试 Agent + 配置模型", async () => {
      await createAgent(page, TEST_AGENT_NAME)

      log("进入组织设置 → API Keys")
      await page.getByTestId("link-org-settings").click()
      await waitForStable(page)
      await page.getByTestId("tab-api-keys").click()
      await page.waitForTimeout(500)

      // Check if DeepSeek key already configured
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

    // ── Step 3: Create Judge Agent + DeepSeek model ──
    await test.step("创建 Judge Agent + 配置模型", async () => {
      await page.goto("/")
      await waitForStable(page)
      await createAgent(page, JUDGE_AGENT_NAME)
      await navigateToAgentBuild(page, JUDGE_AGENT_NAME)
      await setupDeepSeekModel(page, "deepseek_judge")
    })

    // ── Step 4: Judge Config → binary (pass, 0-1) ──
    await test.step("创建二元 Judge Config (pass, min=0, max=1)", async () => {
      log("进入 Judge tab")
      await page.getByTestId("tab-judge").click()
      await page.waitForTimeout(500)

      log("创建 judge config: binary")
      await visible(page, "btn-new-judge-config").click()
      const jcDialog = page.getByRole("dialog")
      await expect(jcDialog).toBeVisible({ timeout: 5_000 })
      await jcDialog.locator("input").first().fill("binary")
      await page.waitForTimeout(300)
      await jcDialog.getByTestId("btn-create-config").click()
      await expect(jcDialog).not.toBeVisible({ timeout: 5_000 })
      await page.waitForTimeout(500)

      log("添加 dimension: pass/通过/weight=1/min=0/max=1")
      await visible(page, "btn-add-dimension").click()
      await page.waitForTimeout(300)
      await page.locator("input[placeholder='key']:visible").fill("pass")
      await page.locator("input[placeholder='Label']:visible").fill("Pass")
      await page.locator("input[placeholder='Weight']:visible").fill("")
      await page.locator("input[placeholder='Weight']:visible").fill("1")
      // Max 默认是 10，需要改成 1
      await page.locator("input[placeholder='Max']:visible").fill("")
      await page.locator("input[placeholder='Max']:visible").fill("1")
      await page.waitForTimeout(300)

      log("保存 judge config")
      await visible(page, "btn-save").click()
      await page.waitForTimeout(1_000)

      log("激活 binary judge config")
      await visible(page, "switch-activate").click()
      await page.waitForTimeout(1_000)
      log("二元 judge config 激活完成")
    })

    // ── Step 5: Test Agent → Eval → Create case ──
    await test.step("创建 Eval Case (2+2=?)", async () => {
      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, TEST_AGENT_NAME)

      log("进入 Eval tab")
      await page.getByTestId("tab-eval").click()
      await page.waitForTimeout(500)

      log("创建 eval case: math_binary")
      await visible(page, "btn-new-case").click()
      const caseDialog = page.getByRole("dialog")
      await expect(caseDialog).toBeVisible({ timeout: 5_000 })
      await caseDialog.locator("input").first().fill("math_binary")
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

    // ── Step 6: Run All ──
    await test.step("Run All + 选择 Judge Agent", async () => {
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
    })

    // ── Step 7: Verify results ──
    await test.step("验证结果：pass rate + score 格式 (x/1)", async () => {
      log("等待 run 完成（最长 180s）...")
      await expect(page.getByTestId("run-pass-rate").first()).toBeVisible({ timeout: 180_000 })
      const passRateText = await page.getByTestId("run-pass-rate").first().textContent()
      log(`run 完成，pass rate: ${passRateText}`)
      await expect(page.getByTestId("run-pass-rate").first()).toHaveText(/1\/1/)

      log("验证 score 格式为 x/1（二元评估）")
      const scoreEl = page.getByTestId("run-score").first()
      await expect(scoreEl).toBeVisible({ timeout: 5_000 })
      const scoreText = await scoreEl.textContent()
      log(`score: ${scoreText}`)
      // Binary scoring: score should be 0/1 or 1/1
      await expect(scoreEl).toHaveText(/[01]\/1/)
      log("二元评估 score 格式验证通过")
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

      await expect(newPage.getByTestId("report-pass-rate")).toHaveText(/1\/1/)
      log("报告页 pass rate 验证通过")
      await expect(newPage.getByTestId("report-score")).toHaveText(/[01]\/1/)
      log("报告页 score 验证通过")
      const reportCards = newPage.getByTestId("result-card")
      await expect(reportCards).toHaveCount(1, { timeout: 10_000 })
      log("报告页 result cards 数量验证通过")
      await newPage.close()
    })
  })
})
