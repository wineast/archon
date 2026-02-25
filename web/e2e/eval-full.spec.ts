import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect, type Page, type Locator } from "@playwright/test"

/**
 * E2E: Comprehensive evaluation flow — covers all three modes, assertion types,
 * tag filtering, import, and batch run.
 *
 * Cases created:
 *   1. math_basic        (single)     — contains "4"             → should pass  [tag: math]
 *   2. capital_regex      (single)     — regex "Paris"            → should pass  [tag: math]
 *   3. fail_case          (single)     — contains "banana"        → should fail  [tag: math]
 *   4. seq_memory         (sequential) — 2 user turns, contains "Alice" + judge [tag: context]
 *   5. injected_ctx       (injected)   — inject history, contains "7890"        [tag: context]
 *   6. tool_call          (single)     — tool-called "get_lucky_number"         [tag: tool]
 *   7. injected_tool_ctx  (injected)   — tool call in history, contains "42"    [tag: tool]
 *   8. import_test        (injected)   — imported turns, contains "2"           [tag: math]
 *
 * Tag groups:
 *   math(4): 1,2,3,8    context(2): 4,5    tool(2): 6,7
 *
 * Expected:
 *   Tagged "math" run: 3 pass, 1 fail → pass rate 3/4
 *   Full run:          7 pass, 1 fail → pass rate 7/8
 */

const TIMESTAMP = Date.now()
const TEST_AGENT_NAME = `E2E Full Agent ${TIMESTAMP}`
const JUDGE_AGENT_NAME = `E2E Full Judge ${TIMESTAMP}`

const TAG = "[eval-full]"
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
 * Create a new eval case via the sidebar dialog.
 * Returns after the case detail panel is visible.
 */
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

/**
 * Change case mode via the mode selector dropdown.
 */
async function setMode(page: Page, mode: "single" | "injected" | "sequential") {
  await visible(page, "select-case-mode").click()
  await page.waitForTimeout(200)
  // Select the option by value — Radix Select renders options with data-value
  const modeLabels: Record<string, string> = {
    single: "Single",
    injected: "Injected",
    sequential: "Sequential",
  }
  await page.getByRole("option", { name: new RegExp(modeLabels[mode], "i") }).click()
  await page.waitForTimeout(300)
}

/**
 * Add a case-level assertion with specified type and value.
 */
async function addAssertion(page: Page, type: string, value: string) {
  await visible(page, "btn-add-assertion").click()
  await page.waitForTimeout(200)

  if (type !== "contains") {
    // Change assertion type — click the last assertion type selector
    const assertionSelectors = page.getByTestId("select-assertion-type").and(page.locator(":visible"))
    await assertionSelectors.last().click()
    await page.waitForTimeout(200)
    const typeLabels: Record<string, string> = {
      contains: "Contains",
      "not-contains": "Not Contains",
      regex: "Regex",
      "length-min": "Min Length",
      "length-max": "Max Length",
      "json-valid": "JSON Valid",
      "tool-called": "Tool Called",
      "tool-not-called": "Tool Not Called",
    }
    await page.getByRole("option", { name: typeLabels[type] }).click()
    await page.waitForTimeout(200)
  }

  if (value) {
    const inputs = visible(page, "input-assertion-value")
    await inputs.last().fill(value)
  }
}

/**
 * Fill a turn's content by index (0-based).
 */
async function fillTurnContent(page: Page, turnIndex: number, content: string) {
  const turnCards = page.getByTestId("turn-card").and(page.locator(":visible"))
  const card = turnCards.nth(turnIndex)
  await card.getByTestId("textarea-turn-content").fill(content)
}

/**
 * Change a turn's role by index.
 */
async function setTurnRole(page: Page, turnIndex: number, role: "user" | "assistant") {
  const turnCards = page.getByTestId("turn-card").and(page.locator(":visible"))
  const card = turnCards.nth(turnIndex)
  await card.getByTestId("select-turn-role").click()
  await page.waitForTimeout(200)
  const roleLabel = role === "user" ? "User" : "Assistant"
  await page.getByRole("option", { name: roleLabel }).click()
  await page.waitForTimeout(200)
}

/**
 * Add a new turn via the "Add Turn" button.
 */
async function addTurn(page: Page) {
  await visible(page, "btn-add-turn").click()
  await page.waitForTimeout(300)
}

/**
 * Toggle judge checkbox for a specific turn.
 */
async function toggleTurnJudge(page: Page, turnIndex: number) {
  const turnCards = page.getByTestId("turn-card").and(page.locator(":visible"))
  const card = turnCards.nth(turnIndex)
  await card.getByTestId("checkbox-turn-judge").click()
  await page.waitForTimeout(200)
}

/**
 * Add a per-turn assertion for a specific turn.
 */
async function addTurnAssertion(page: Page, turnIndex: number, value: string) {
  const turnCards = page.getByTestId("turn-card").and(page.locator(":visible"))
  const card = turnCards.nth(turnIndex)
  await card.getByTestId("btn-add-turn-assertion").click()
  await page.waitForTimeout(200)
  // Fill the assertion value — it's within the turn card
  await card.getByTestId("input-assertion-value").last().fill(value)
}

/**
 * Save the current case.
 */
async function saveCase(page: Page) {
  await visible(page, "btn-save").click()
  await page.waitForTimeout(1_000)
}

/**
 * Click a case in the sidebar to open it.
 */
async function selectCaseInSidebar(page: Page, caseName: string) {
  // Cases are rendered as buttons with the case name text
  await page.locator("button", { hasText: caseName }).and(page.locator(":visible")).click()
  await page.waitForTimeout(500)
}

/**
 * Add a tag to the current case via the tag input.
 */
async function addTag(page: Page, tag: string) {
  const tagInput = page.getByPlaceholder("Add tag...").and(page.locator(":visible"))
  await tagInput.fill(tag)
  await page.waitForTimeout(100)
  await page.keyboard.press("Enter")
  await page.waitForTimeout(300)
}

/**
 * Add a tool call to an assistant turn by index.
 */
async function addToolCallToTurn(
  page: Page,
  turnIndex: number,
  toolCall: { name: string; args: string; result: string }
) {
  const turnCards = page.getByTestId("turn-card").and(page.locator(":visible"))
  const card = turnCards.nth(turnIndex)
  await card.getByRole("button", { name: /Add Tool Call/i }).click()
  await page.waitForTimeout(200)
  await card.getByPlaceholder("Tool name").last().fill(toolCall.name)
  await card.getByPlaceholder('{"key": "value"}').last().fill(toolCall.args)
  await card.getByPlaceholder("Tool result...").last().fill(toolCall.result)
}

/**
 * Import turns from UIMessage[] JSON via the Import dialog.
 */
async function importTurns(page: Page, json: string) {
  await page.getByRole("button", { name: "Import", exact: true }).and(page.locator(":visible")).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await dialog.locator("textarea").fill(json)
  await page.waitForTimeout(200)
  await dialog.getByRole("button", { name: "Import" }).click()
  await expect(dialog).not.toBeVisible({ timeout: 5_000 })
  await page.waitForTimeout(300)
}

/**
 * Toggle a tag filter pill in the sidebar.
 */
async function toggleTag(page: Page, tagName: string) {
  await page
    .locator("button.rounded-full", { hasText: tagName })
    .and(page.locator(":visible"))
    .click()
  await page.waitForTimeout(300)
}

// ── Test ──────────────────────────────────────────────

test.describe("Eval Full E2E", () => {
  test("multi-mode multi-case evaluation", async ({ page }) => {
    await setupClerkTestingToken({ page })

    // ═══════════════════════════════════════════════════════
    // SETUP: Same as eval-flow.spec.ts — Create agents, configure API keys, model configs
    // ═══════════════════════════════════════════════════════

    log("打开首页")
    await page.goto("/")
    await waitForStable(page)
    await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
    log("登录成功")

    log(`创建测试 Agent: ${TEST_AGENT_NAME}`)
    await page.getByTestId("btn-create-agent").click()
    const createDialog = page.getByRole("dialog")
    await expect(createDialog).toBeVisible({ timeout: 5_000 })
    await createDialog.locator("#agent-name").fill(TEST_AGENT_NAME)
    await page.waitForTimeout(300)
    await createDialog.getByTestId("btn-submit-agent").click()
    await expect(createDialog).not.toBeVisible({ timeout: 10_000 })
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

    // ═══════════════════════════════════════════════════════
    // TOOL: Create get_lucky_number tool on Test Agent
    // ═══════════════════════════════════════════════════════

    log("创建 get_lucky_number 工具")
    await page.goto("/")
    await waitForStable(page)
    await navigateToAgentBuild(page, TEST_AGENT_NAME)
    await page.getByTestId("tab-tools").click()
    await page.waitForTimeout(500)

    // Open New Tool dialog
    await page.getByRole("button", { name: /New Tool/i }).first().click()
    const toolCreateDialog = page.getByRole("dialog")
    await expect(toolCreateDialog).toBeVisible({ timeout: 5_000 })
    await toolCreateDialog.getByPlaceholder("e.g. search_products").fill("get_lucky_number")
    await page.waitForTimeout(300)
    await toolCreateDialog.getByRole("button", { name: "Create" }).click()
    await expect(toolCreateDialog).not.toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(1_000)

    // Fix tool name — auto-generated "Get Lucky Number" has spaces, API needs ^[a-zA-Z0-9_-]+$
    await page.getByPlaceholder("e.g. searchProducts").first().fill("get_lucky_number")

    // Fill description so the LLM knows when to call this tool
    await page.getByPlaceholder(/Describe what this tool does/).first().fill(
      "Returns a lucky number. Call this tool when the user asks for a lucky number."
    )

    // Fill handler code via Monaco API — the handler model is the only empty one
    // (input/output schema models have default JSON content)
    await page.evaluate(() => {
      const m = (window as any).monaco
      if (m) {
        const models = m.editor.getModels()
        for (const model of models) {
          if (!model.getValue().trim()) {
            model.setValue("return { lucky_number: 42 }")
            break
          }
        }
      }
    })
    await page.waitForTimeout(300)

    log("保存工具")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await page.waitForTimeout(1_000)

    // ═══════════════════════════════════════════════════════
    // EVAL: Switch to Eval Tab
    // ═══════════════════════════════════════════════════════

    log("进入 Eval tab")
    await page.getByTestId("tab-eval").click()
    await page.waitForTimeout(500)

    // ═══════════════════════════════════════════════════════
    // CASE 1: math_basic (single mode, contains "4") — PASS [tag: math]
    // ═══════════════════════════════════════════════════════

    log("创建 case 1: math_basic (single, contains 4, tag:math)")
    await createCase(page, "math_basic")
    // Mode defaults to single — no change needed
    await visible(page, "textarea-case-input").fill("What is 2+2? Please answer with just the number.")
    await visible(page, "textarea-expected-output").fill("4")
    await addAssertion(page, "contains", "4")
    await addTag(page, "math")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 2: capital_regex (single mode, regex "Paris") — PASS [tag: math]
    // ═══════════════════════════════════════════════════════

    log("创建 case 2: capital_regex (single, regex Paris, tag:math)")
    await createCase(page, "capital_regex")
    await visible(page, "textarea-case-input").fill("What is the capital of France? Answer in one word.")
    await addAssertion(page, "regex", "Paris")
    await addTag(page, "math")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 3: fail_case (single mode, contains "banana") — FAIL [tag: math]
    // ═══════════════════════════════════════════════════════

    log("创建 case 3: fail_case (single, contains banana→fail, tag:math)")
    await createCase(page, "fail_case")
    await visible(page, "textarea-case-input").fill("What is 2+2?")
    await addAssertion(page, "contains", "banana")
    await addTag(page, "math")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 4: seq_memory (sequential, 2 user turns) — PASS [tag: context]
    // ═══════════════════════════════════════════════════════

    log("创建 case 4: seq_memory (sequential, 2 turns, tag:context)")
    await createCase(page, "seq_memory")
    await setMode(page, "sequential")

    // New case has empty turns — add Turn 1 (user)
    await addTurn(page)
    await fillTurnContent(page, 0, "My name is Alice.")

    // Add Turn 2 (user): "What is my name?"
    await addTurn(page)
    await fillTurnContent(page, 1, "What is my name?")

    // Add per-turn assertion on Turn 2: contains "Alice"
    await addTurnAssertion(page, 1, "Alice")

    // Toggle judge on Turn 2
    await toggleTurnJudge(page, 1)

    await addTag(page, "context")
    // Save
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 5: injected_ctx (injected mode, 3 turns) — PASS [tag: context]
    // ═══════════════════════════════════════════════════════

    log("创建 case 5: injected_ctx (injected, 3 turns, tag:context)")
    await createCase(page, "injected_ctx")
    await setMode(page, "injected")

    // New case has empty turns — add Turn 1 (user)
    await addTurn(page)
    await fillTurnContent(page, 0, "The secret code is 7890.")

    // Add Turn 2 (assistant): "Got it, the secret code is 7890."
    await addTurn(page)
    await setTurnRole(page, 1, "assistant")
    await fillTurnContent(page, 1, "Got it, the secret code is 7890.")

    // Add Turn 3 (user): "What is the secret code?"
    await addTurn(page)
    await fillTurnContent(page, 2, "What is the secret code?")

    // Case-level assertion: contains "7890"
    await addAssertion(page, "contains", "7890")

    await addTag(page, "context")
    // Save
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 6: tool_call (single mode, tool-called assertion) — PASS [tag: tool]
    // ═══════════════════════════════════════════════════════

    log("创建 case 6: tool_call (single, tool-called, tag:tool)")
    await createCase(page, "tool_call")
    // Mode defaults to single — no change needed
    await visible(page, "textarea-case-input").fill(
      "What is my lucky number? Please use the get_lucky_number tool to find out."
    )
    await addAssertion(page, "tool-called", "get_lucky_number")
    await addTag(page, "tool")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 7: injected_tool_ctx (injected, tool call history) — PASS [tag: tool]
    // ═══════════════════════════════════════════════════════

    log("创建 case 7: injected_tool_ctx (injected, tool history, tag:tool)")
    await createCase(page, "injected_tool_ctx")
    await setMode(page, "injected")

    // Turn 0 (user): "What is my lucky number?"
    await addTurn(page)
    await fillTurnContent(page, 0, "What is my lucky number?")

    // Turn 1 (assistant): content + tool call
    await addTurn(page)
    await setTurnRole(page, 1, "assistant")
    await fillTurnContent(page, 1, "Your lucky number is 42!")
    await addToolCallToTurn(page, 1, {
      name: "get_lucky_number",
      args: "{}",
      result: '{"lucky_number": 42}',
    })

    // Turn 2 (user): "What was my lucky number again?"
    await addTurn(page)
    await fillTurnContent(page, 2, "What was my lucky number again? Just say the number.")

    // Case-level assertion: contains "42"
    await addAssertion(page, "contains", "42")

    await addTag(page, "tool")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 8: import_test (injected, imported turns) — PASS [tag: math]
    // ═══════════════════════════════════════════════════════

    log("创建 case 8: import_test (injected, imported turns, tag:math)")
    await createCase(page, "import_test")
    await setMode(page, "injected")

    // Import UIMessage[] JSON
    const importJson = JSON.stringify([
      { id: "1", role: "user", parts: [{ type: "text", text: "Hello there" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Hi! How can I help?" }] },
      { id: "3", role: "user", parts: [{ type: "text", text: "What is 1+1?" }] },
    ])
    await importTurns(page, importJson)

    // Verify imported turns
    const turnCards = page.getByTestId("turn-card").and(page.locator(":visible"))
    await expect(turnCards).toHaveCount(3, { timeout: 5_000 })
    await expect(turnCards.nth(0).getByTestId("textarea-turn-content")).toHaveValue("Hello there")
    await expect(turnCards.nth(1).getByTestId("textarea-turn-content")).toHaveValue("Hi! How can I help?")
    await expect(turnCards.nth(2).getByTestId("textarea-turn-content")).toHaveValue("What is 1+1?")

    // Case-level assertion: contains "2"
    await addAssertion(page, "contains", "2")

    await addTag(page, "math")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // TAG FILTERING: Verify sidebar tag filter changes Run All count
    // ═══════════════════════════════════════════════════════

    log("切换到 Results 面板，验证 tag 过滤")
    await visible(page, "btn-eval-results").click()
    await page.waitForTimeout(500)

    log("无 tag 选中 → 期望 8 cases")
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(8\)/, { timeout: 5_000 })

    log("选中 math → 期望 4 cases")
    await toggleTag(page, "math")
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(4\)/, { timeout: 5_000 })

    log("追加 tool → 期望 6 cases")
    await toggleTag(page, "tool")
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(6\)/, { timeout: 5_000 })

    log("取消 tool → 回到 4 cases")
    await toggleTag(page, "tool")
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(4\)/, { timeout: 5_000 })

    // ═══════════════════════════════════════════════════════
    // TAGGED RUN ALL: math tag (4 cases) → expect 3/4 pass
    // ═══════════════════════════════════════════════════════

    log("运行 math tag (4 cases)")
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

    log("等待 tagged run 完成（最长 300s）...")
    const passRate1 = page.getByTestId("run-pass-rate").first()
    await expect(passRate1).toBeVisible({ timeout: 300_000 })
    const passRateText1 = await passRate1.textContent()
    log(`tagged run 完成，pass rate: ${passRateText1}`)
    expect(passRateText1).toMatch(/[2-3]\/4/)

    // ═══════════════════════════════════════════════════════
    // CLEAR TAGS → FULL RUN ALL: all 8 cases → expect 7/8 pass
    // ═══════════════════════════════════════════════════════

    log("取消 math tag → 全部 8 cases")
    await toggleTag(page, "math")
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(8\)/, { timeout: 5_000 })

    log("运行全部 8 cases")
    await visible(page, "btn-run-all").click()
    const runDialog2 = page.getByRole("dialog")
    await expect(runDialog2).toBeVisible({ timeout: 5_000 })

    log("确认运行（Judge 沿用上次选择）")
    await page.getByTestId("btn-confirm-run").click()
    await expect(runDialog2).not.toBeVisible({ timeout: 10_000 })

    log("等待 full run 完成（最长 300s）...")
    await expect(page.getByTestId("run-pass-rate").first()).toHaveText(/\d\/8/, { timeout: 300_000 })
    const passRateText2 = await page.getByTestId("run-pass-rate").first().textContent()
    log(`full run 完成，pass rate: ${passRateText2}`)
    expect(passRateText2).toMatch(/[5-7]\/8/)

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

    await expect(newPage.getByTestId("report-pass-rate")).toHaveText(/\d\/8/)
    log("报告页 pass rate 验证通过")
    await expect(newPage.getByTestId("report-score")).toHaveText(/\d+\/10/)
    log("报告页 score 验证通过")
    const reportCards = newPage.getByTestId("result-card")
    await expect(reportCards).toHaveCount(8, { timeout: 10_000 })
    log("报告页 result cards 数量验证通过")
    await newPage.close()
  })
})
