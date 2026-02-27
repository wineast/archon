import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect, type Page } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"
import JSZip from "jszip"

/**
 * E2E: 服务端工具回归测试
 *
 * 回归场景：Vercel AI SDK 的 onToolCall 会为所有工具调用触发（包括服务端工具）。
 * 修复前，executeClientTool 会对服务端工具返回 { error: "Tool not found" }，
 * 导致对话 UI 出现虚假错误。
 *
 * 测试流程：
 *   1. 配置 DeepSeek API Key
 *   2. 动态压缩 fixture → ZIP，通过导入功能创建 Agent
 *   3. 与 Agent 对话，触发服务端工具调用
 *   4. 验证工具正常执行，无 "Tool not found" 错误
 */

const TAG = "[server-tool-regression]"
const log = (...args: unknown[]) => console.log(TAG, ...args)

const FIXTURE_JSON = path.resolve(__dirname, "fixtures/server-tool-agent.json")
const FIXTURE_ZIP = path.resolve(__dirname, "fixtures/.server-tool-agent.zip")

// ── Helpers ──────────────────────────────────────────────

async function waitForStable(page: Page) {
  await page.waitForLoadState("networkidle")
}

/** 将 manifest.json 动态打包为 ZIP（测试前置） */
async function buildFixtureZip() {
  const manifest = fs.readFileSync(FIXTURE_JSON, "utf-8")
  const zip = new JSZip()
  zip.file("manifest.json", manifest)
  const buf = await zip.generateAsync({ type: "nodebuffer" })
  fs.writeFileSync(FIXTURE_ZIP, buf)
  log(`fixture ZIP 生成完成: ${FIXTURE_ZIP} (${buf.length} bytes)`)
}

test.describe("服务端工具回归测试", () => {
  // AI chat needs more time than default 30s
  test.setTimeout(120_000)

  test("服务端工具调用不应触发客户端 'Tool not found' 错误", async ({
    page,
  }) => {
    await setupClerkTestingToken({ page })

    // ── Step 1: 登录 ──
    await test.step("登录首页", async () => {
      log("打开首页")
      await page.goto("/")
      await waitForStable(page)
      await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
      log("登录成功")
    })

    // ── Step 2: 配置 DeepSeek API Key ──
    await test.step("配置 DeepSeek API Key", async () => {
      log("进入组织设置 → API Keys")
      await page.getByTestId("link-org-settings").click()
      await waitForStable(page)
      await page.getByTestId("tab-api-keys").click()
      await page.waitForTimeout(500)

      // Check if DeepSeek is already configured
      const row = page.getByTestId("api-key-row-deepseek")
      const text = await row.textContent()
      if (text?.includes("未配置")) {
        await page.getByTestId("btn-configure-deepseek").click()
        await page.waitForTimeout(300)
        log("填入 DeepSeek API Key")
        await page
          .getByTestId("input-api-key")
          .fill(process.env.E2E_DEEPSEEK_API_KEY!)
        await page.getByTestId("btn-save-api-key").click()
        await page.waitForTimeout(1_000)
        await expect(row).not.toContainText("未配置", { timeout: 5_000 })
        log("API Key 保存成功")
      } else {
        log("DeepSeek API Key 已配置，跳过")
      }
    })

    // ── Step 3: 动态压缩 fixture 并导入 ──
    await test.step("导入 fixture agent 并进入对话页", async () => {
      await buildFixtureZip()

      log("回到首页")
      await page.goto("/")
      await waitForStable(page)

      log("导入 fixture ZIP")
      const fileInput = page.locator('input[type="file"][accept=".zip"]')
      await fileInput.setInputFiles(FIXTURE_ZIP)

      // Wait for import to complete — agent card should appear
      const card = page
        .locator("a", { hasText: "E2E Server Tool Regression" })
        .first()
      await expect(card).toBeVisible({ timeout: 30_000 })
      log("fixture 导入完成")

      // Extract href and navigate to chat page
      const href = await card.getAttribute("href")
      if (!href) throw new Error("Agent card href not found")
      log(`导航到对话页: ${href}`)
      await page.goto(href)
      await waitForStable(page)
      log("进入对话页")
    })

    // ── Step 4: 发送消息触发服务端工具 ──
    await test.step("发送消息触发服务端工具", async () => {
      log("等待输入框可用")
      const textarea = page.locator("textarea").first()
      await expect(textarea).toBeVisible({ timeout: 10_000 })

      log("输入消息")
      await textarea.fill("Please greet TestUser")
      await page.waitForTimeout(300)
      await textarea.press("Enter")
      log("消息已发送，等待 AI 响应")
    })

    // ── Step 5: 验证工具执行结果 ──
    await test.step("验证工具执行结果", async () => {
      const mainContent = page.locator("main")

      // Wait for the AI to relay the greeting (proves the server tool executed)
      log("等待 AI 响应出现 greeting 内容")
      await expect(mainContent).toContainText(/Hello.*TestUser/i, {
        timeout: 60_000,
      })
      log("AI 响应包含 greeting")

      // Wait for streaming to fully complete (Stop button disappears)
      await expect(
        page.getByRole("button", { name: "Stop" })
      ).not.toBeVisible({ timeout: 10_000 })
      log("流式输出完成")

      // Get all text for final assertions
      const text = await mainContent.textContent()
      log(`页面文本 (前 500 字): ${text?.substring(0, 500)}`)

      // CRITICAL ASSERTION: "Tool not found" should NEVER appear
      expect(text).not.toContain("Tool not found")
      log("✓ 无 'Tool not found' 错误")

      // The tool call should show as completed
      expect(text).toContain("get_greeting")
      log("✓ 工具调用记录存在")
    })
  })
})
