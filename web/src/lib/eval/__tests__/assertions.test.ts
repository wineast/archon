import { describe, it, expect } from "vitest";
import { runAllAssertions } from "../assertions";
import type { Assertion, AssertionType, ToolCallRecord } from "../types";

function makeAssertion(
  type: AssertionType,
  value: string = ""
): Assertion {
  return { id: "test-id", type, value };
}

const sampleToolCalls: ToolCallRecord[] = [
  { toolName: "getWeather", args: { city: "Tokyo", unit: "celsius" }, result: "25°C" },
  { toolName: "searchWeb", args: { query: "hello world" }, result: "..." },
];

describe("assertions", () => {
  describe("contains", () => {
    it("passes when response contains the value", () => {
      const results = runAllAssertions(
        [makeAssertion("contains", "Paris")],
        "The capital of France is Paris."
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toBe('Response contains "Paris"');
    });

    it("is case-insensitive", () => {
      const results = runAllAssertions(
        [makeAssertion("contains", "paris")],
        "PARIS is beautiful"
      );
      expect(results[0].passed).toBe(true);
    });

    it("fails when response does not contain the value", () => {
      const results = runAllAssertions(
        [makeAssertion("contains", "Berlin")],
        "The capital of France is Paris."
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toBe('Response does not contain "Berlin"');
    });

    it("handles empty value (always passes)", () => {
      const results = runAllAssertions(
        [makeAssertion("contains", "")],
        "any response"
      );
      expect(results[0].passed).toBe(true);
    });

    it("handles empty response", () => {
      const results = runAllAssertions(
        [makeAssertion("contains", "something")],
        ""
      );
      expect(results[0].passed).toBe(false);
    });

    it("matches substring not just whole words", () => {
      const results = runAllAssertions(
        [makeAssertion("contains", "ar")],
        "Paris"
      );
      expect(results[0].passed).toBe(true);
    });
  });

  describe("not-contains", () => {
    it("passes when response does not contain the value", () => {
      const results = runAllAssertions(
        [makeAssertion("not-contains", "password")],
        "I cannot help with that."
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toBe('Response does not contain "password"');
    });

    it("is case-insensitive", () => {
      const results = runAllAssertions(
        [makeAssertion("not-contains", "SECRET")],
        "This contains a secret word"
      );
      expect(results[0].passed).toBe(false);
    });

    it("fails when response contains the value", () => {
      const results = runAllAssertions(
        [makeAssertion("not-contains", "hack")],
        "Here is how to hack..."
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toBe('Response contains "hack" (unexpected)');
    });

    it("handles empty value (always fails, empty is always contained)", () => {
      const results = runAllAssertions(
        [makeAssertion("not-contains", "")],
        "any response"
      );
      expect(results[0].passed).toBe(false);
    });

    it("passes on empty response for non-empty value", () => {
      const results = runAllAssertions(
        [makeAssertion("not-contains", "something")],
        ""
      );
      expect(results[0].passed).toBe(true);
    });
  });

  describe("regex", () => {
    it("passes when response matches regex", () => {
      const results = runAllAssertions(
        [makeAssertion("regex", "\\d{3}-\\d{4}")],
        "Call me at 555-1234"
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toContain("matches regex");
    });

    it("fails when response does not match regex", () => {
      const results = runAllAssertions(
        [makeAssertion("regex", "^\\d+$")],
        "not a number"
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toContain("does not match regex");
    });

    it("handles invalid regex gracefully", () => {
      const results = runAllAssertions(
        [makeAssertion("regex", "[invalid")],
        "any response"
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toBe("Invalid regex: [invalid");
    });

    it("supports anchored patterns", () => {
      const pass = runAllAssertions(
        [makeAssertion("regex", "^Hello")],
        "Hello world"
      );
      expect(pass[0].passed).toBe(true);

      const fail = runAllAssertions(
        [makeAssertion("regex", "^Hello")],
        "Say Hello"
      );
      expect(fail[0].passed).toBe(false);
    });

    it("matches partial response by default", () => {
      const results = runAllAssertions(
        [makeAssertion("regex", "\\d+")],
        "abc 123 def"
      );
      expect(results[0].passed).toBe(true);
    });
  });

  describe("length-min", () => {
    it("passes when response length >= min", () => {
      const results = runAllAssertions(
        [makeAssertion("length-min", "5")],
        "Hello World"
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toBe("Response length (11) >= 5");
    });

    it("passes when response length equals min exactly", () => {
      const results = runAllAssertions(
        [makeAssertion("length-min", "5")],
        "Hello"
      );
      expect(results[0].passed).toBe(true);
    });

    it("fails when response length < min", () => {
      const results = runAllAssertions(
        [makeAssertion("length-min", "100")],
        "Short"
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toBe("Response length (5) < 100");
    });

    it("handles zero min length", () => {
      const results = runAllAssertions(
        [makeAssertion("length-min", "0")],
        ""
      );
      expect(results[0].passed).toBe(true);
    });

    it("treats NaN value as 0 (NaN parsed as NaN, length >= NaN is false)", () => {
      const results = runAllAssertions(
        [makeAssertion("length-min", "abc")],
        "test"
      );
      // parseInt("abc") = NaN, 4 >= NaN = false
      expect(results[0].passed).toBe(false);
    });
  });

  describe("length-max", () => {
    it("passes when response length <= max", () => {
      const results = runAllAssertions(
        [makeAssertion("length-max", "100")],
        "Short response"
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toBe("Response length (14) <= 100");
    });

    it("passes when response length equals max exactly", () => {
      const results = runAllAssertions(
        [makeAssertion("length-max", "5")],
        "Hello"
      );
      expect(results[0].passed).toBe(true);
    });

    it("fails when response length > max", () => {
      const results = runAllAssertions(
        [makeAssertion("length-max", "3")],
        "Too long"
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toBe("Response length (8) > 3");
    });

    it("max 0 only passes for empty string", () => {
      expect(
        runAllAssertions([makeAssertion("length-max", "0")], "")[0].passed
      ).toBe(true);
      expect(
        runAllAssertions([makeAssertion("length-max", "0")], "a")[0].passed
      ).toBe(false);
    });
  });

  describe("json-valid", () => {
    it("passes for valid JSON object", () => {
      const results = runAllAssertions(
        [makeAssertion("json-valid")],
        '{"name": "Alice", "age": 30}'
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toBe("Response is valid JSON");
    });

    it("passes for valid JSON array", () => {
      const results = runAllAssertions(
        [makeAssertion("json-valid")],
        "[1, 2, 3]"
      );
      expect(results[0].passed).toBe(true);
    });

    it("passes for JSON primitives", () => {
      expect(
        runAllAssertions([makeAssertion("json-valid")], '"hello"')[0].passed
      ).toBe(true);
      expect(
        runAllAssertions([makeAssertion("json-valid")], "42")[0].passed
      ).toBe(true);
      expect(
        runAllAssertions([makeAssertion("json-valid")], "true")[0].passed
      ).toBe(true);
      expect(
        runAllAssertions([makeAssertion("json-valid")], "null")[0].passed
      ).toBe(true);
    });

    it("fails for invalid JSON", () => {
      const results = runAllAssertions(
        [makeAssertion("json-valid")],
        "not valid json"
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toBe("Response is not valid JSON");
    });

    it("fails for empty string", () => {
      const results = runAllAssertions([makeAssertion("json-valid")], "");
      expect(results[0].passed).toBe(false);
    });

    it("fails for trailing comma JSON", () => {
      const results = runAllAssertions(
        [makeAssertion("json-valid")],
        '{"a": 1,}'
      );
      expect(results[0].passed).toBe(false);
    });

    it("ignores assertion value field", () => {
      const results = runAllAssertions(
        [makeAssertion("json-valid", "ignored")],
        '{"valid": true}'
      );
      expect(results[0].passed).toBe(true);
    });
  });

  // ── Tool call assertion tests ──

  describe("tool-called", () => {
    it("passes when tool was called", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called", "getWeather")],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toBe('Tool "getWeather" was called');
    });

    it("fails when tool was not called", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called", "sendEmail")],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toBe('Tool "sendEmail" was not called');
    });

    it("fails with empty toolCalls array", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called", "getWeather")],
        "any response",
        []
      );
      expect(results[0].passed).toBe(false);
    });

    it("fails with undefined toolCalls", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called", "getWeather")],
        "any response"
      );
      expect(results[0].passed).toBe(false);
    });
  });

  describe("tool-not-called", () => {
    it("passes when tool was not called", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-not-called", "sendEmail")],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toBe('Tool "sendEmail" was not called (as expected)');
    });

    it("fails when tool was called", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-not-called", "getWeather")],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toBe('Tool "getWeather" was called (unexpected)');
    });

    it("passes with empty toolCalls array", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-not-called", "getWeather")],
        "any response",
        []
      );
      expect(results[0].passed).toBe(true);
    });

    it("passes with undefined toolCalls", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-not-called", "getWeather")],
        "any response"
      );
      expect(results[0].passed).toBe(true);
    });
  });

  describe("tool-called-with-contains", () => {
    it("passes when tool was called with matching subset of args", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-contains", '{"tool":"getWeather","args":{"city":"Tokyo"}}')],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toContain("was called with args containing");
    });

    it("fails when args do not match", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-contains", '{"tool":"getWeather","args":{"city":"London"}}')],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toContain("was not called with args containing");
    });

    it("fails when tool name does not match", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-contains", '{"tool":"unknown","args":{"city":"Tokyo"}}')],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(false);
    });

    it("fails with invalid JSON value", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-contains", "not json")],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toContain("Invalid JSON value");
    });

    it("passes with empty args subset", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-contains", '{"tool":"getWeather","args":{}}')],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(true);
    });

    it("fails with undefined toolCalls", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-contains", '{"tool":"getWeather","args":{"city":"Tokyo"}}')],
        "any response"
      );
      expect(results[0].passed).toBe(false);
    });
  });

  describe("tool-called-with-exact", () => {
    it("passes when tool was called with exact args", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-exact", '{"tool":"getWeather","args":{"city":"Tokyo","unit":"celsius"}}')],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toContain("was called with exact args");
    });

    it("fails when args have extra fields", () => {
      // The actual call has {city, unit} but we only specify {city} — exact requires all fields
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-exact", '{"tool":"getWeather","args":{"city":"Tokyo"}}')],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(false);
    });

    it("fails when args differ", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-exact", '{"tool":"getWeather","args":{"city":"London","unit":"celsius"}}')],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(false);
    });

    it("fails with invalid JSON value", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-exact", "{bad")],
        "any response",
        sampleToolCalls
      );
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toContain("Invalid JSON value");
    });

    it("fails with undefined toolCalls", () => {
      const results = runAllAssertions(
        [makeAssertion("tool-called-with-exact", '{"tool":"getWeather","args":{"city":"Tokyo","unit":"celsius"}}')],
        "any response"
      );
      expect(results[0].passed).toBe(false);
    });
  });

  describe("runAllAssertions", () => {
    it("returns empty array for no assertions", () => {
      expect(runAllAssertions([], "any response")).toHaveLength(0);
    });

    it("runs multiple assertions and returns results for each", () => {
      const assertions: Assertion[] = [
        makeAssertion("contains", "Paris"),
        makeAssertion("not-contains", "Berlin"),
        makeAssertion("length-min", "10"),
      ];
      const results = runAllAssertions(
        assertions,
        "The capital of France is Paris."
      );
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it("reports mixed results correctly", () => {
      const assertions: Assertion[] = [
        makeAssertion("contains", "Paris"),
        makeAssertion("contains", "Berlin"),
      ];
      const results = runAllAssertions(
        assertions,
        "The capital of France is Paris."
      );
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
    });

    it("preserves assertion reference in results", () => {
      const assertion = makeAssertion("contains", "test");
      const results = runAllAssertions([assertion], "this is a test");
      expect(results[0].assertion).toBe(assertion);
    });

    it("runs all 6 text assertion types without error", () => {
      const assertions: Assertion[] = [
        makeAssertion("contains", "x"),
        makeAssertion("not-contains", "z"),
        makeAssertion("regex", "x"),
        makeAssertion("length-min", "1"),
        makeAssertion("length-max", "100"),
        makeAssertion("json-valid"),
      ];
      const results = runAllAssertions(assertions, '"x"');
      expect(results).toHaveLength(6);
      // "x" is contained, "z" is not, regex matches, length 3 >= 1, length 3 <= 100, '"x"' is valid JSON
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it("maintains assertion order in results", () => {
      const a1 = { ...makeAssertion("contains", "a"), id: "first" };
      const a2 = { ...makeAssertion("contains", "b"), id: "second" };
      const results = runAllAssertions([a1, a2], "a b");
      expect(results[0].assertion.id).toBe("first");
      expect(results[1].assertion.id).toBe("second");
    });

    it("text assertions work without toolCalls (backward compat)", () => {
      const results = runAllAssertions(
        [makeAssertion("contains", "hello")],
        "hello world"
      );
      expect(results[0].passed).toBe(true);
    });

    it("mixes text and tool assertions", () => {
      const assertions: Assertion[] = [
        makeAssertion("contains", "result"),
        makeAssertion("tool-called", "getWeather"),
        makeAssertion("tool-not-called", "sendEmail"),
      ];
      const results = runAllAssertions(assertions, "here is the result", sampleToolCalls);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.passed)).toBe(true);
    });
  });
});
