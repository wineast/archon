import type { Assertion, AssertionResult } from "./types";

function runAssertion(assertion: Assertion, response: string): AssertionResult {
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
  }
}

export function runAllAssertions(
  assertions: Assertion[],
  response: string
): AssertionResult[] {
  return assertions.map((a) => runAssertion(a, response));
}
