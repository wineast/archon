import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect, type Page, type Locator } from "@playwright/test"

/**
 * E2E: Comprehensive evaluation flow — covers all three modes, assertion types, and batch run.
 *
 * Cases created:
 *   1. math_basic     (single)     — contains "4"         → should pass
 *   2. capital_regex   (single)     — regex "Paris"        → should pass
 *   3. fail_case       (single)     — contains "banana"    → should fail
 *   4. seq_memory      (sequential) — 2 user turns, Turn 2 contains "Alice" + judge
 *   5. injected_ctx    (injected)   — inject history, last question, contains "7890"
 *   6. tool_call       (single)     — tool-called "get_lucky_number" → should pass
 *
 * Expected: 5 pass, 1 fail → pass rate 5/6
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
    // CASE 1: math_basic (single mode, contains "4") — PASS
    // ═══════════════════════════════════════════════════════

    await createCase(page, "math_basic")
    // Mode defaults to single — no change needed
    await visible(page, "textarea-case-input").fill("What is 2+2? Please answer with just the number.")
    await visible(page, "textarea-expected-output").fill("4")
    await addAssertion(page, "contains", "4")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 2: capital_regex (single mode, regex "Paris") — PASS
    // ═══════════════════════════════════════════════════════

    await createCase(page, "capital_regex")
    await visible(page, "textarea-case-input").fill("What is the capital of France? Answer in one word.")
    await addAssertion(page, "regex", "Paris")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 3: fail_case (single mode, contains "banana") — FAIL
    // ═══════════════════════════════════════════════════════

    await createCase(page, "fail_case")
    await visible(page, "textarea-case-input").fill("What is 2+2?")
    await addAssertion(page, "contains", "banana")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 4: seq_memory (sequential, 2 user turns) — PASS
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

    // Save
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 5: injected_ctx (injected mode, 3 turns) — PASS
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

    // Save
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // CASE 6: tool_call (single mode, tool-called assertion) — PASS
    // ═══════════════════════════════════════════════════════

    await createCase(page, "tool_call")
    // Mode defaults to single — no change needed
    await visible(page, "textarea-case-input").fill(
      "What is my lucky number? Please use the get_lucky_number tool to find out."
    )
    await addAssertion(page, "tool-called", "get_lucky_number")
    await saveCase(page)

    // ═══════════════════════════════════════════════════════
    // RUN ALL: Switch to Results → Run All → Select Judge → Confirm
    // ═══════════════════════════════════════════════════════

    await visible(page, "btn-eval-results").click()
    await page.waitForTimeout(500)

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

    // ═══════════════════════════════════════════════════════
    // VERIFY RESULTS: Wait for completion and check outcomes
    // ═══════════════════════════════════════════════════════

    // Wait for at least one "Passed" badge in the expanded results — up to 300s for 6 cases with real API
    await expect(page.getByTestId("badge-passed").first()).toBeVisible({ timeout: 300_000 })

    // Wait for all cases to complete — expect at least one "Failed" badge too
    await expect(page.getByTestId("badge-failed").first()).toBeVisible({ timeout: 300_000 })

    // Wait for the run to fully complete — pass rate appears only after all cases finish
    const passRate = page.getByTestId("run-pass-rate").first()
    await expect(passRate).toBeVisible({ timeout: 300_000 })
    const passRateText = await passRate.textContent()
    // Should show x/6 where x >= 4 (at least the deterministic cases pass)
    expect(passRateText).toMatch(/[4-5]\/6/)

    // Verify score exists
    await expect(page.getByTestId("run-score").first()).toHaveText(/[1-9]\d?\/10/)
  })
})
