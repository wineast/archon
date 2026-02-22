import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveTemplate, BUILTIN_VAR_NAMES, TIME_VAR_NAMES, EVAL_VAR_NAMES } from "../template";

describe("template", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-15T10:30:45.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("built-in variables", () => {
    it("resolves {{date}}", () => {
      expect(resolveTemplate("Today is {{date}}", {})).toBe(
        "Today is 2025-03-15"
      );
    });

    it("resolves {{time}}", () => {
      const result = resolveTemplate("{{time}}", {});
      // time is locale-dependent, just check format HH:MM:SS
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it("resolves {{year}}, {{month}}, {{day}}", () => {
      expect(resolveTemplate("{{year}}-{{month}}-{{day}}", {})).toBe(
        "2025-03-15"
      );
    });

    it("pads month and day with leading zeros", () => {
      expect(resolveTemplate("{{month}}", {})).toBe("03");
      expect(resolveTemplate("{{day}}", {})).toBe("15");
    });

    it("resolves {{datetime}} as ISO string", () => {
      expect(resolveTemplate("{{datetime}}", {})).toBe(
        "2025-03-15T10:30:45.000Z"
      );
    });

    it("resolves {{timestamp}} as milliseconds", () => {
      expect(resolveTemplate("{{timestamp}}", {})).toBe(
        String(new Date("2025-03-15T10:30:45.000Z").getTime())
      );
    });

    it("resolves {{model}} from context", () => {
      expect(
        resolveTemplate("Using {{model}}", {}, { model: "openai/gpt-4o" })
      ).toBe("Using openai/gpt-4o");
    });

    it("resolves {{caseCount}} from context", () => {
      expect(
        resolveTemplate("{{caseCount}} cases", {}, { caseCount: 5 })
      ).toBe("5 cases");
    });

    it("resolves {{caseName}} from context", () => {
      expect(
        resolveTemplate("Case: {{caseName}}", {}, { caseName: "Test A" })
      ).toBe("Case: Test A");
    });

    it("defaults context values to empty/zero when not provided", () => {
      expect(
        resolveTemplate("{{model}}|{{caseCount}}|{{caseName}}", {})
      ).toBe("|0|");
    });

    it("all BUILTIN_VAR_NAMES resolve to a non-undefined value", () => {
      for (const name of BUILTIN_VAR_NAMES) {
        const result = resolveTemplate(`{{${name}}}`, {}, {
          model: "test",
          caseCount: 1,
          caseName: "test",
        });
        // Should not remain as the placeholder
        expect(result).not.toBe(`{{${name}}}`);
      }
    });
  });

  describe("custom variables", () => {
    it("resolves a single custom variable", () => {
      expect(resolveTemplate("Reply in {{lang}}", { lang: "Chinese" })).toBe(
        "Reply in Chinese"
      );
    });

    it("resolves multiple custom variables", () => {
      expect(
        resolveTemplate("{{greeting}}, {{name}}!", {
          greeting: "Hello",
          name: "Alice",
        })
      ).toBe("Hello, Alice!");
    });

    it("custom vars override built-in vars", () => {
      expect(resolveTemplate("{{date}}", { date: "custom-date" })).toBe(
        "custom-date"
      );
    });

    it("custom vars override context vars", () => {
      expect(
        resolveTemplate(
          "{{model}}",
          { model: "my-custom-model" },
          { model: "openai/gpt-4o" }
        )
      ).toBe("my-custom-model");
    });

    it("handles custom var with empty string value", () => {
      expect(resolveTemplate("prefix{{v}}suffix", { v: "" })).toBe(
        "prefixsuffix"
      );
    });

    it("handles custom var with special characters in value", () => {
      expect(
        resolveTemplate("{{v}}", { v: "hello $world & <tag>" })
      ).toBe("hello $world & <tag>");
    });
  });

  describe("edge cases", () => {
    it("returns template unchanged when no placeholders", () => {
      expect(resolveTemplate("No placeholders here", {})).toBe(
        "No placeholders here"
      );
    });

    it("leaves unknown variables as-is", () => {
      expect(resolveTemplate("{{unknown}}", {})).toBe("{{unknown}}");
    });

    it("handles empty template", () => {
      expect(resolveTemplate("", {})).toBe("");
    });

    it("handles multiple occurrences of the same variable", () => {
      expect(resolveTemplate("{{lang}} and {{lang}}", { lang: "EN" })).toBe(
        "EN and EN"
      );
    });

    it("handles adjacent variables", () => {
      expect(resolveTemplate("{{a}}{{b}}", { a: "X", b: "Y" })).toBe("XY");
    });

    it("nested braces: {{{var}}} resolves inner and preserves outer", () => {
      expect(resolveTemplate("{{{lang}}}", { lang: "EN" })).toBe("{EN}");
    });

    it("ignores malformed placeholders", () => {
      expect(resolveTemplate("{ {var} }", { var: "val" })).toBe("{ {var} }");
      expect(resolveTemplate("{var}", { var: "val" })).toBe("{var}");
    });

    it("only matches word characters (\\w) in variable names", () => {
      expect(resolveTemplate("{{a-b}}", {})).toBe("{{a-b}}");
      expect(resolveTemplate("{{a b}}", {})).toBe("{{a b}}");
      expect(resolveTemplate("{{a.b}}", {})).toBe("{{a.b}}");
      expect(resolveTemplate("{{a_b}}", { a_b: "ok" })).toBe("ok");
      expect(resolveTemplate("{{a1}}", { a1: "ok" })).toBe("ok");
    });

    it("handles template with only a placeholder", () => {
      expect(resolveTemplate("{{x}}", { x: "val" })).toBe("val");
    });

    it("handles many variables in one template", () => {
      const vars: Record<string, string> = {};
      let template = "";
      for (let i = 0; i < 20; i++) {
        vars[`v${i}`] = String(i);
        template += `{{v${i}}} `;
      }
      const result = resolveTemplate(template, vars);
      expect(result.trim()).toBe(
        Array.from({ length: 20 }, (_, i) => String(i)).join(" ")
      );
    });
  });

  describe("TIME_VAR_NAMES", () => {
    it("has exactly 7 entries", () => {
      expect(TIME_VAR_NAMES).toHaveLength(7);
    });

    it("contains all time-related names", () => {
      const expected = ["date", "time", "datetime", "timestamp", "year", "month", "day"];
      for (const name of expected) {
        expect(TIME_VAR_NAMES).toContain(name);
      }
    });
  });

  describe("EVAL_VAR_NAMES", () => {
    it("has exactly 3 entries", () => {
      expect(EVAL_VAR_NAMES).toHaveLength(3);
    });

    it("contains all eval-specific names", () => {
      const expected = ["model", "caseCount", "caseName"];
      for (const name of expected) {
        expect(EVAL_VAR_NAMES).toContain(name);
      }
    });
  });

  describe("BUILTIN_VAR_NAMES", () => {
    it("has exactly 10 entries", () => {
      expect(BUILTIN_VAR_NAMES).toHaveLength(10);
    });

    it("equals TIME_VAR_NAMES + EVAL_VAR_NAMES", () => {
      expect([...BUILTIN_VAR_NAMES]).toEqual([...TIME_VAR_NAMES, ...EVAL_VAR_NAMES]);
    });

    it("contains all expected names", () => {
      const expected = [
        "date", "time", "datetime", "timestamp",
        "year", "month", "day",
        "model", "caseCount", "caseName",
      ];
      for (const name of expected) {
        expect(BUILTIN_VAR_NAMES).toContain(name);
      }
    });

    it("is a readonly tuple", () => {
      // TypeScript ensures this at compile time; runtime check for array
      expect(Array.isArray(BUILTIN_VAR_NAMES)).toBe(true);
    });
  });
});
