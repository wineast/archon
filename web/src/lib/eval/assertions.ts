import equal from "fast-deep-equal";
import type { Assertion, AssertionResult, ToolCallRecord } from "./types";

function isSubset(subset: Record<string, unknown>, full: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(subset)) {
    if (!(key in full)) return false;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      if (typeof full[key] !== "object" || full[key] === null || Array.isArray(full[key])) return false;
      if (!isSubset(value as Record<string, unknown>, full[key] as Record<string, unknown>)) return false;
    } else {
      if (!equal(value, full[key])) return false;
    }
  }
  return true;
}

function runAssertion(
  assertion: Assertion,
  response: string,
  toolCalls?: ToolCallRecord[]
): AssertionResult {
  switch (assertion.type) {
    case "contains": {
      const passed = response.toLowerCase().includes(assertion.value.toLowerCase());
      return {
        assertion,
        passed,
        message: passed
          ? `Response contains "${assertion.value}"`
          : `Response does not contain "${assertion.value}"`,
      };
    }
    case "not-contains": {
      const passed = !response.toLowerCase().includes(assertion.value.toLowerCase());
      return {
        assertion,
        passed,
        message: passed
          ? `Response does not contain "${assertion.value}"`
          : `Response contains "${assertion.value}" (unexpected)`,
      };
    }
    case "regex": {
      try {
        const regex = new RegExp(assertion.value);
        const passed = regex.test(response);
        return {
          assertion,
          passed,
          message: passed
            ? `Response matches regex /${assertion.value}/`
            : `Response does not match regex /${assertion.value}/`,
        };
      } catch {
        return {
          assertion,
          passed: false,
          message: `Invalid regex: ${assertion.value}`,
        };
      }
    }
    case "length-min": {
      const min = parseInt(assertion.value, 10);
      const passed = response.length >= min;
      return {
        assertion,
        passed,
        message: passed
          ? `Response length (${response.length}) >= ${min}`
          : `Response length (${response.length}) < ${min}`,
      };
    }
    case "length-max": {
      const max = parseInt(assertion.value, 10);
      const passed = response.length <= max;
      return {
        assertion,
        passed,
        message: passed
          ? `Response length (${response.length}) <= ${max}`
          : `Response length (${response.length}) > ${max}`,
      };
    }
    case "json-valid": {
      try {
        JSON.parse(response);
        return { assertion, passed: true, message: "Response is valid JSON" };
      } catch {
        return { assertion, passed: false, message: "Response is not valid JSON" };
      }
    }
    case "tool-called": {
      const tcs = toolCalls ?? [];
      const passed = tcs.some((tc) => tc.toolName === assertion.value);
      return {
        assertion,
        passed,
        message: passed
          ? `Tool "${assertion.value}" was called`
          : `Tool "${assertion.value}" was not called`,
      };
    }
    case "tool-not-called": {
      const tcs = toolCalls ?? [];
      const passed = !tcs.some((tc) => tc.toolName === assertion.value);
      return {
        assertion,
        passed,
        message: passed
          ? `Tool "${assertion.value}" was not called (as expected)`
          : `Tool "${assertion.value}" was called (unexpected)`,
      };
    }
    case "tool-called-with-contains": {
      const tcs = toolCalls ?? [];
      try {
        const { tool, args } = JSON.parse(assertion.value) as { tool: string; args: Record<string, unknown> };
        const match = tcs.find((tc) => tc.toolName === tool && isSubset(args, tc.args));
        return {
          assertion,
          passed: !!match,
          message: match
            ? `Tool "${tool}" was called with args containing ${JSON.stringify(args)}`
            : `Tool "${tool}" was not called with args containing ${JSON.stringify(args)}`,
        };
      } catch {
        return {
          assertion,
          passed: false,
          message: `Invalid JSON value for tool-called-with-contains: ${assertion.value}`,
        };
      }
    }
    case "tool-called-with-exact": {
      const tcs = toolCalls ?? [];
      try {
        const { tool, args } = JSON.parse(assertion.value) as { tool: string; args: Record<string, unknown> };
        const match = tcs.find((tc) => tc.toolName === tool && equal(tc.args, args));
        return {
          assertion,
          passed: !!match,
          message: match
            ? `Tool "${tool}" was called with exact args ${JSON.stringify(args)}`
            : `Tool "${tool}" was not called with exact args ${JSON.stringify(args)}`,
        };
      } catch {
        return {
          assertion,
          passed: false,
          message: `Invalid JSON value for tool-called-with-exact: ${assertion.value}`,
        };
      }
    }
  }
}

export function runAllAssertions(
  assertions: Assertion[],
  response: string,
  toolCalls?: ToolCallRecord[]
): AssertionResult[] {
  return assertions.map((a) => runAssertion(a, response, toolCalls));
}
