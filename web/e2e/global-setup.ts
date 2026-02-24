import { clerkSetup } from "@clerk/testing/playwright"

/**
 * Playwright globalSetup — runs once before all tests.
 * Calls clerkSetup() to fetch a testing token from Clerk Backend API
 * and stores it in process.env for worker processes to read.
 */
async function globalSetup() {
  await clerkSetup()
}

export default globalSetup
