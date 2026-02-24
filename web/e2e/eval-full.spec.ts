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

// ── Helpers ──────────────────────────────────────────────

async function waitForStable(page: Page) {
  await page.waitForLoadState("networkidle")
}

async function navigateToAgentBuild(page: Page, agentName: string) {
  const card = page.locator("a", { hasText: agentName })
  await card.getByTestId("btn-agent-menu").click({ force: true })
  await page.waitForTimeout(300)
  await page.getByTestId("menu-item-build").click()
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

    // ── Step 1: Login ──
    await page.goto("/")
    await waitForStable(page)
    await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })

    // ── Step 2: Create Test Agent ──
    await page.getByTestId("btn-create-agent").click()
    const createDialog = page.getByRole("dialog")
    await expect(createDialog).toBeVisible({ timeout: 5_000 })
    await createDialog.locator("#agent-name").fill(TEST_AGENT_NAME)
    await page.waitForTimeout(300)
    await createDialog.getByTestId("btn-submit-agent").click()
    await expect(createDialog).not.toBeVisible({ timeout: 10_000 })

    // ── Step 3: Org Settings → DeepSeek API Key ──
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

    // ── Step 4: Test Agent → Model Config ──
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

    // ── Step 5: Create Judge Agent ──
    await page.goto("/")
    await waitForStable(page)
    await page.getByTestId("btn-create-agent").click()
    const judgeDialog = page.getByRole("dialog")
    await expect(judgeDialog).toBeVisible({ timeout: 5_000 })
    await judgeDialog.locator("#agent-name").fill(JUDGE_AGENT_NAME)
    await page.waitForTimeout(300)
    await judgeDialog.getByTestId("btn-submit-agent").click()
    await expect(judgeDialog).not.toBeVisible({ timeout: 10_000 })

    // ── Step 6: Judge Agent → Model Config ──
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

    // ── Step 7: Judge Agent → Judge Config ──
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

    // ═══════════════════════════════════════════════════════
    // TOOL: Create get_lucky_number tool on Test Agent
    // ═══════════════════════════════════════════════════════

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

    // Save tool
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await page.waitForTimeout(1_000)

    // ═══════════════════════════════════════════════════════
    // EVAL: Switch to Eval Tab
    // ═══════════════════════════════════════════════════════

    await page.getByTestId("tab-eval").click()
    await page.waitForTimeout(500)

    // ═══════════════════════════════════════════════════════
    // CASE 1: math_basic (single mode, contains "4") — PASS [tag: math]
    // ═══════════════════════════════════════════════════════

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

    await createCase(page, "capital_regex")
    await visible(page, "textarea-case-input").fill("What is the capital of France? Answer in one word.")
    await addAssertion(page, "regex", "Paris")
    await addTag(page, "math")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 3: fail_case (single mode, contains "banana") — FAIL [tag: math]
    // ═══════════════════════════════════════════════════════

    await createCase(page, "fail_case")
    await visible(page, "textarea-case-input").fill("What is 2+2?")
    await addAssertion(page, "contains", "banana")
    await addTag(page, "math")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 4: seq_memory (sequential, 2 user turns) — PASS [tag: context]
    // ═══════════════════════════════════════════════════════

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

    await visible(page, "btn-eval-results").click()
    await page.waitForTimeout(500)

    // No tags selected → all 8 cases
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(8\)/, { timeout: 5_000 })

    // Click "math" → 4 cases (math_basic, capital_regex, fail_case, import_test)
    await toggleTag(page, "math")
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(4\)/, { timeout: 5_000 })

    // Add "tool" → 6 cases (math 4 + tool 2, no overlap)
    await toggleTag(page, "tool")
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(6\)/, { timeout: 5_000 })

    // Remove "tool" → back to 4 (just math)
    await toggleTag(page, "tool")
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(4\)/, { timeout: 5_000 })

    // ═══════════════════════════════════════════════════════
    // TAGGED RUN ALL: math tag (4 cases) → expect 3/4 pass
    // ═══════════════════════════════════════════════════════

    await visible(page, "btn-run-all").click()

    const runDialog = page.getByRole("dialog")
    await expect(runDialog).toBeVisible({ timeout: 5_000 })

    // Select Judge Agent
    await page.getByTestId("select-judge-agent").click()
    await page.waitForTimeout(500)
    await page.getByRole("option", { name: new RegExp(JUDGE_AGENT_NAME) }).click()
    await page.waitForTimeout(500)

    // Confirm run
    await page.getByTestId("btn-confirm-run").click()
    await expect(runDialog).not.toBeVisible({ timeout: 10_000 })

    // Wait for pass rate to appear (run completed) — up to 300s for real LLM calls
    const passRate1 = page.getByTestId("run-pass-rate").first()
    await expect(passRate1).toBeVisible({ timeout: 300_000 })
    const passRateText1 = await passRate1.textContent()
    // Should show x/4 where x >= 2 (at least the deterministic cases pass)
    expect(passRateText1).toMatch(/[2-3]\/4/)

    // ═══════════════════════════════════════════════════════
    // CLEAR TAGS → FULL RUN ALL: all 8 cases → expect 7/8 pass
    // ═══════════════════════════════════════════════════════

    // Deselect "math" to clear all tag filters
    await toggleTag(page, "math")
    await expect(visible(page, "btn-run-all")).toHaveText(/Run All \(8\)/, { timeout: 5_000 })

    // Run All (full)
    await visible(page, "btn-run-all").click()
    const runDialog2 = page.getByRole("dialog")
    await expect(runDialog2).toBeVisible({ timeout: 5_000 })

    // Judge already selected from previous run — just confirm
    await page.getByTestId("btn-confirm-run").click()
    await expect(runDialog2).not.toBeVisible({ timeout: 10_000 })

    // Wait for the latest run's pass rate — should match x/8
    await expect(page.getByTestId("run-pass-rate").first()).toHaveText(/\d\/8/, { timeout: 300_000 })
    const passRateText2 = await page.getByTestId("run-pass-rate").first().textContent()
    // Should show x/8 where x >= 5 (at least the deterministic cases pass)
    expect(passRateText2).toMatch(/[5-7]\/8/)

    // Verify score exists
    await expect(page.getByTestId("run-score").first()).toHaveText(/[1-9]\d?\/10/)
  })
})
