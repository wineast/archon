import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect, type Page } from "@playwright/test"

/**
 * E2E: Single-case Run uses draft (unsaved) content.
 *
 * Verifies that clicking the per-case "Run" button executes using the
 * current editor state (React state), NOT the last-saved database version.
 *
 * Flow:
 *   1. Login → Agents page
 *   2. Create Test Agent + configure DeepSeek model
 *   3. Create Judge Agent + configure DeepSeek model + Judge Config
 *   4. Test Agent → Eval tab → Create case "draft_test" (prompt: "2+2=?", assertion: contains "4") → Save
 *   5. Modify prompt to "What is the capital of France?" + assertion to contains "Paris" — do NOT save
 *   6. Click per-case Run → select Judge → confirm
 *   7. Switch to History view → verify run-pass-rate = 1/1 (proves draft was used,
 *      because saved assertions check "4" while draft assertions check "Paris")
 */

const TIMESTAMP = Date.now()
const TEST_AGENT_NAME = `E2E SingleRun Agent ${TIMESTAMP}`
const JUDGE_AGENT_NAME = `E2E SingleRun Judge ${TIMESTAMP}`

const TAG = "[eval-single-run]"
const log = (...args: unknown[]) => console.log(TAG, ...args)

// ── Helpers ──────────────────────────────────────────────

async function waitForStable(page: Page) {
  await page.waitForLoadState("networkidle")
}

async function navigateToAgentBuild(page: Page, agentName: string) {
  log(`navigateToAgentBuild: ${agentName}`)
  const card = page.locator("a", { hasText: agentName })
  await card.waitFor({ state: "visible", timeout: 10_000 })
  const href = await card.getAttribute("href")
  const buildUrl = href!.replace(/\/chat$/, "/build")
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

// ── Test ──────────────────────────────────────────────

test.describe("单用例 Run 使用草稿内容", () => {
  test("草稿修改未保存时，单用例 Run 执行的是当前编辑器内容", async ({ page }) => {
    await setupClerkTestingToken({ page })

    // ── Step 1: 登录 ──
    await test.step("登录", async () => {
      log("打开首页")
      await page.goto("/")
      await waitForStable(page)
      await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
      log("登录成功")
    })

    // ── Step 2: 创建测试 Agent + 配置模型 ──
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

    // ── Step 3: 创建 Judge Agent + 配置模型 ──
    await test.step("创建 Judge Agent + 配置模型", async () => {
      await page.goto("/")
      await waitForStable(page)
      await createAgent(page, JUDGE_AGENT_NAME)
      await navigateToAgentBuild(page, JUDGE_AGENT_NAME)
      await setupDeepSeekModel(page, "deepseek_judge")
    })

    // ── Step 4: 创建 Judge Config ──
    await test.step("创建 Judge Config", async () => {
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

      log("添加 dimension: accuracy/Accuracy/weight=1")
      await visible(page, "btn-add-dimension").click()
      await page.waitForTimeout(300)
      await page.locator("input[placeholder='key']:visible").fill("accuracy")
      await page.locator("input[placeholder='Label']:visible").fill("Accuracy")
      await page.locator("input[placeholder='Weight']:visible").fill("")
      await page.locator("input[placeholder='Weight']:visible").fill("1")
      await page.waitForTimeout(300)

      log("保存 judge config")
      await visible(page, "btn-save").click()
      await page.waitForTimeout(1_000)

      log("激活 judge config")
      await visible(page, "switch-activate").click()
      await page.waitForTimeout(1_000)
      log("Judge config 激活完成")
    })

    // ── Step 5: 创建 Eval Case 并保存 ──
    await test.step("创建 Eval Case (2+2=?) 并保存", async () => {
      await page.goto("/")
      await waitForStable(page)
      await navigateToAgentBuild(page, TEST_AGENT_NAME)

      log("进入 Eval tab")
      await page.getByTestId("tab-eval").click()
      await page.waitForTimeout(500)

      log("创建 eval case: draft_test")
      await visible(page, "btn-new-case").click()
      const caseDialog = page.getByRole("dialog")
      await expect(caseDialog).toBeVisible({ timeout: 5_000 })
      await caseDialog.locator("input").first().fill("draft_test")
      await page.waitForTimeout(300)
      await caseDialog.getByTestId("btn-create-config").click()
      await expect(caseDialog).not.toBeVisible({ timeout: 5_000 })
      await page.waitForTimeout(500)

      log("填写初始内容：prompt=2+2=?，assertion=contains 4")
      await visible(page, "textarea-case-input").fill("What is 2+2? Please answer with just the number.")
      await visible(page, "textarea-expected-output").fill("4")
      await visible(page, "btn-add-assertion").click()
      await page.waitForTimeout(300)
      await visible(page, "input-assertion-value").fill("4")

      log("保存 case")
      await visible(page, "btn-save").click()
      await page.waitForTimeout(1_000)
      log("case 保存完成（数据库中存的是 2+2=? 相关内容）")
    })

    // ── Step 6: 修改草稿但不保存 ──
    await test.step("修改草稿内容但不保存", async () => {
      log("修改 prompt → 法国首都问题")
      await visible(page, "textarea-case-input").fill("What is the capital of France? Answer with just the city name.")

      log("修改 expectedOutput")
      await visible(page, "textarea-expected-output").fill("Paris")

      log("修改 assertion value → Paris")
      await visible(page, "input-assertion-value").fill("Paris")

      log("确认表单处于 dirty 状态（Save 按钮应可用）")
      await expect(visible(page, "btn-save")).toBeEnabled()
      log("草稿已修改，未保存")
    })

    // ── Step 7: 单用例 Run ──
    await test.step("点击单用例 Run 按钮", async () => {
      log("点击 Run 按钮")
      await visible(page, "btn-run-case").click()

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
      log("Run 已启动，等待结果...")
    })

    // ── Step 8: 验证结果 ──
    await test.step("验证 Run 结果使用了草稿内容", async () => {
      log("切换到 History 视图查看 run-pass-rate")
      await page.getByTestId("btn-eval-results").click()
      await page.waitForTimeout(500)

      log("等待 run-pass-rate 出现（最长 180s）...")
      const passRate = page.getByTestId("run-pass-rate").first()
      await expect(passRate).toBeVisible({ timeout: 180_000 })
      const passRateText = await passRate.textContent()
      log(`run-pass-rate: ${passRateText}`)

      // pass-rate = 1/1 proves draft was used:
      // - saved assertion checks "4" (for "2+2=?")
      // - draft assertion checks "Paris" (for "capital of France")
      // - if saved version was used, assertion would fail → 0/1
      await expect(passRate).toHaveText(/1\/1/)
      log("pass rate 1/1 — 证明单用例 Run 使用的是草稿内容而非数据库已保存内容")
    })
  })
})
