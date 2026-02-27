import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect, type Page } from "@playwright/test"

/**
 * E2E: Judge Prompt Template — 验证 Judge Config 的 Prompt Template 编辑功能。
 *
 * Flow:
 *   1. Login → Agents page
 *   2. Create Agent
 *   3. Navigate to Build → Judge tab
 *   4. Create Judge Config
 *   5. Verify default prompt template / turn prompt template pre-filled
 *   6. Edit prompt template via Monaco API
 *   7. Save → Verify "Restore default" button appears
 *   8. Click "Restore default" → Verify template restored
 *   9. Save restored state
 */

const TIMESTAMP = Date.now()
const TEST_AGENT_NAME = `E2E Judge PT ${TIMESTAMP}`

const TAG = "[eval-judge-prompt-template]"
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

/**
 * Get the value of a Monaco editor inside a data-testid container.
 * Finds the Monaco editor instance attached to the container's textarea.
 */
async function getMonacoValue(page: Page, sectionTestId: string): Promise<string> {
  return page.evaluate((testId) => {
    const section = document.querySelector(`[data-testid="${testId}"]`)
    if (!section) throw new Error(`Section ${testId} not found`)
    const textarea = section.querySelector("textarea")
    if (!textarea) throw new Error(`Textarea not found in ${testId}`)
    // Monaco attaches editor to textarea's parent
    const editorContainer = textarea.closest("[data-slot='md-editor']")
    if (!editorContainer) throw new Error(`Editor container not found in ${testId}`)
    // Get all Monaco models and find the one matching this editor
    const models = (window as any).monaco?.editor?.getModels() as any[]
    if (!models || models.length === 0) throw new Error("No Monaco models found")
    // Each Monaco editor instance is attached to a DOM node
    const editors = (window as any).monaco?.editor?.getEditors() as any[]
    for (const editor of editors) {
      const domNode = editor.getDomNode()
      if (domNode && editorContainer.contains(domNode)) {
        return editor.getModel()?.getValue() ?? ""
      }
    }
    throw new Error(`Could not find Monaco editor in ${testId}`)
  }, sectionTestId)
}

/**
 * Set the value of a Monaco editor inside a data-testid container.
 */
async function setMonacoValue(page: Page, sectionTestId: string, value: string): Promise<void> {
  await page.evaluate(({ testId, val }) => {
    const section = document.querySelector(`[data-testid="${testId}"]`)
    if (!section) throw new Error(`Section ${testId} not found`)
    const editorContainer = section.querySelector("[data-slot='md-editor']")
    if (!editorContainer) throw new Error(`Editor container not found in ${testId}`)
    const editors = (window as any).monaco?.editor?.getEditors() as any[]
    for (const editor of editors) {
      const domNode = editor.getDomNode()
      if (domNode && editorContainer.contains(domNode)) {
        editor.getModel()?.setValue(val)
        return
      }
    }
    throw new Error(`Could not find Monaco editor in ${testId}`)
  }, { testId: sectionTestId, val: value })
}

test.describe("Judge Prompt Template 编辑", () => {
  test("创建 Judge Config 并编辑 Prompt Template", async ({ page }) => {
    await setupClerkTestingToken({ page })

    await test.step("登录并创建 Agent", async () => {
      log("打开首页")
      await page.goto("/")
      await waitForStable(page)
      await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
      log("登录成功")

      log(`创建 Agent: ${TEST_AGENT_NAME}`)
      await page.getByTestId("btn-create-agent").click()
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible({ timeout: 5_000 })
      await dialog.locator("#agent-name").fill(TEST_AGENT_NAME)
      await page.waitForTimeout(300)
      await dialog.getByTestId("btn-submit-agent").click()
      await expect(dialog).not.toBeVisible({ timeout: 10_000 })
      log("Agent 创建完成")
    })

    await test.step("进入 Judge tab 并创建 Judge Config", async () => {
      await navigateToAgentBuild(page, TEST_AGENT_NAME)

      log("进入 Judge tab")
      await page.getByTestId("tab-judge").click()
      await page.waitForTimeout(500)

      log("创建 judge config: e2e_prompt_test")
      await visible(page, "btn-new-judge-config").click()
      const jcDialog = page.getByRole("dialog")
      await expect(jcDialog).toBeVisible({ timeout: 5_000 })
      await jcDialog.locator("input").first().fill("e2e_prompt_test")
      await page.waitForTimeout(300)
      await jcDialog.getByTestId("btn-create-config").click()
      await expect(jcDialog).not.toBeVisible({ timeout: 5_000 })
      await page.waitForTimeout(1_000)
      log("Judge Config 创建完成")
    })

    await test.step("验证默认模板已预填", async () => {
      log("检查 Prompt Template 区域可见")
      await expect(visible(page, "section-prompt-template")).toBeVisible({ timeout: 5_000 })
      await expect(visible(page, "section-turn-prompt-template")).toBeVisible({ timeout: 5_000 })

      // Wait for Monaco to initialize
      await page.waitForTimeout(2_000)

      log("读取 Prompt Template 内容")
      const promptValue = await getMonacoValue(page, "section-prompt-template")
      log(`Prompt Template 内容长度: ${promptValue.length}`)
      expect(promptValue.length).toBeGreaterThan(0)
      expect(promptValue).toContain("user_input")
      expect(promptValue).toContain("conversation")

      log("读取 Turn Prompt Template 内容")
      const turnValue = await getMonacoValue(page, "section-turn-prompt-template")
      log(`Turn Prompt Template 内容长度: ${turnValue.length}`)
      expect(turnValue.length).toBeGreaterThan(0)
      expect(turnValue).toContain("conversation")

      log("默认模板验证通过")
    })

    await test.step("编辑 Prompt Template 并保存", async () => {
      const customTemplate = "Custom template: {{ user_input }} → {{ actual_response }}"
      log(`设置自定义 Prompt Template: ${customTemplate}`)
      await setMonacoValue(page, "section-prompt-template", customTemplate)
      await page.waitForTimeout(500)

      log("验证 Restore default 按钮出现")
      await expect(visible(page, "btn-restore-prompt-template")).toBeVisible({ timeout: 3_000 })

      log("添加 dimension 以满足保存条件")
      await visible(page, "btn-add-dimension").click()
      await page.waitForTimeout(300)
      await page.locator("input[placeholder='key']:visible").fill("quality")
      await page.locator("input[placeholder='Label']:visible").fill("Quality")
      await page.locator("input[placeholder='Weight']:visible").fill("")
      await page.locator("input[placeholder='Weight']:visible").fill("1")
      await page.waitForTimeout(300)

      log("保存")
      await visible(page, "btn-save").click()
      await page.waitForTimeout(2_000)
      log("保存完成")

      log("验证保存后 Prompt Template 内容保持")
      const savedValue = await getMonacoValue(page, "section-prompt-template")
      expect(savedValue).toBe(customTemplate)
      log("保存后内容验证通过")
    })

    await test.step("Restore default 恢复默认模板", async () => {
      log("点击 Restore default 按钮")
      await visible(page, "btn-restore-prompt-template").click()
      await page.waitForTimeout(500)

      log("验证 Restore default 按钮消失（已恢复默认）")
      await expect(page.getByTestId("btn-restore-prompt-template")).not.toBeVisible({ timeout: 3_000 })

      log("验证内容已恢复为默认模板")
      const restoredValue = await getMonacoValue(page, "section-prompt-template")
      expect(restoredValue).toContain("user_input")
      expect(restoredValue).toContain("conversation")
      expect(restoredValue).not.toContain("Custom template")

      log("保存恢复后的状态")
      await visible(page, "btn-save").click()
      await page.waitForTimeout(2_000)
      log("Restore default 验证通过")
    })

    await test.step("编辑 Turn Prompt Template", async () => {
      const customTurn = "Turn: {{ conversation }}"
      log(`设置自定义 Turn Prompt Template: ${customTurn}`)
      await setMonacoValue(page, "section-turn-prompt-template", customTurn)
      await page.waitForTimeout(500)

      log("验证 Turn Restore default 按钮出现")
      await expect(visible(page, "btn-restore-turn-prompt-template")).toBeVisible({ timeout: 3_000 })

      log("保存")
      await visible(page, "btn-save").click()
      await page.waitForTimeout(2_000)

      log("点击 Turn Restore default")
      await visible(page, "btn-restore-turn-prompt-template").click()
      await page.waitForTimeout(500)

      log("验证恢复")
      await expect(page.getByTestId("btn-restore-turn-prompt-template")).not.toBeVisible({ timeout: 3_000 })
      const restoredTurn = await getMonacoValue(page, "section-turn-prompt-template")
      expect(restoredTurn).toContain("conversation")
      expect(restoredTurn).not.toContain("Turn:")

      log("保存最终状态")
      await visible(page, "btn-save").click()
      await page.waitForTimeout(2_000)
      log("Turn Prompt Template 验证通过")
    })
  })
})
