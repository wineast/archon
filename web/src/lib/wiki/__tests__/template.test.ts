import { describe, expect, it } from "vitest";
import { processTemplate } from "../template";
import type { WikiDocument } from "../types";

function makeDoc(overrides: Partial<WikiDocument> = {}): WikiDocument {
  return {
    id: "doc-1",
    parentId: null,
    key: "",
    name: "Test Doc",
    content: "",
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeCtx(
  doc: WikiDocument,
  documents: WikiDocument[] = [doc],
  variables?: Record<string, unknown>
) {
  return { documents, currentDoc: doc, variables };
}

describe("processTemplate", () => {
  describe("variable interpolation", () => {
    it("replaces {{documentTitle}}", () => {
      const doc = makeDoc({ name: "Hello" });
      const result = processTemplate("Title: {{documentTitle}}", makeCtx(doc));
      expect(result).toBe("Title: Hello");
    });

    it("replaces {{documentCount}}", () => {
      const doc1 = makeDoc({ id: "1" });
      const doc2 = makeDoc({ id: "2" });
      const result = processTemplate(
        "Total: {{documentCount}}",
        makeCtx(doc1, [doc1, doc2])
      );
      expect(result).toBe("Total: 2");
    });

    it("replaces {{currentDate}}", () => {
      const doc = makeDoc();
      const result = processTemplate("Date: {{currentDate}}", makeCtx(doc));
      expect(result).toMatch(/Date: \d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it("replaces custom variables", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "Hello {{username}}",
        makeCtx(doc, [doc], { username: "Alice" })
      );
      expect(result).toBe("Hello Alice");
    });

    it("unknown variables resolve to empty string", () => {
      const doc = makeDoc();
      const result = processTemplate("{{unknown}}", makeCtx(doc));
      expect(result).toBe("");
    });
  });

  describe("{% if %}...{% endif %} conditionals", () => {
    it("shows content when truthy", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "{% if show %}visible{% endif %}",
        makeCtx(doc, [doc], { show: true })
      );
      expect(result).toBe("visible");
    });

    it("hides content when falsy", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "{% if show %}visible{% endif %}",
        makeCtx(doc, [doc], { show: false })
      );
      expect(result).toBe("");
    });

    it("supports {% else %} branch", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "{% if show %}yes{% else %}no{% endif %}",
        makeCtx(doc, [doc], { show: false })
      );
      expect(result).toBe("no");
    });

    it("supports {% unless %}", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "{% unless hidden %}visible{% endunless %}",
        makeCtx(doc, [doc], { hidden: false })
      );
      expect(result).toBe("visible");
    });

    it("treats empty array as truthy (LiquidJS/JS behavior)", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "{% if items %}has{% else %}empty{% endif %}",
        makeCtx(doc, [doc], { items: [] })
      );
      // LiquidJS with jsTruthy: [] is truthy in JavaScript
      expect(result).toBe("has");
    });

    it("supports nested conditionals", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "{% if a %}A{% if b %}B{% endif %}{% endif %}",
        makeCtx(doc, [doc], { a: true, b: true })
      );
      expect(result).toBe("AB");
    });
  });

  describe("{% for %}...{% endfor %} loops", () => {
    it("iterates over array", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "{% for item in items %}- {{item}}\n{% endfor %}",
        makeCtx(doc, [doc], { items: ["apple", "banana", "orange"] })
      );
      expect(result).toBe("- apple\n- banana\n- orange\n");
    });

    it("supports forloop.index0", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "{% for item in items %}{{forloop.index0}}.{{item}} {% endfor %}",
        makeCtx(doc, [doc], { items: ["A", "B"] })
      );
      expect(result).toBe("0.A 1.B ");
    });

    it("renders nothing for empty array", () => {
      const doc = makeDoc();
      const result = processTemplate(
        "{% for item in items %}item{% endfor %}",
        makeCtx(doc, [doc], { items: [] })
      );
      expect(result).toBe("");
    });

    it("iterates over built-in documentList", () => {
      const doc1 = makeDoc({ id: "1", name: "Doc A" });
      const doc2 = makeDoc({ id: "2", name: "Doc B" });
      const result = processTemplate(
        "{% for item in documentList %}- {{item}}\n{% endfor %}",
        makeCtx(doc1, [doc1, doc2])
      );
      expect(result).toBe("- Doc A\n- Doc B\n");
    });
  });

  describe("{% include 'key' %} document embedding", () => {
    it("includes document by key", () => {
      const header = makeDoc({
        id: "header",
        key: "header",
        name: "Header",
        content: "# Company Wiki",
      });
      const main = makeDoc({
        id: "main",
        key: "home",
        name: "Home",
        content: "{% include 'header' %}\n\nBody content",
      });
      const result = processTemplate(
        main.content,
        makeCtx(main, [header, main])
      );
      expect(result).toBe("# Company Wiki\n\nBody content");
    });

    it("shows warning for missing document", () => {
      const doc = makeDoc({ content: "{% include 'missing' %}" });
      const result = processTemplate(doc.content, makeCtx(doc));
      expect(result).toContain("Document not found: missing");
    });

    it("prevents circular references", () => {
      const docA = makeDoc({
        id: "a",
        key: "a",
        name: "A",
        content: "Content A\n{% include 'b' %}",
      });
      const docB = makeDoc({
        id: "b",
        key: "b",
        name: "B",
        content: "Content B\n{% include 'a' %}",
      });
      const result = processTemplate(
        docA.content,
        makeCtx(docA, [docA, docB])
      );
      expect(result).toContain("Content A");
      expect(result).toContain("Content B");
      expect(result).toContain("Circular reference: A");
    });

    it("processes templates in included documents", () => {
      const partial = makeDoc({
        id: "p",
        key: "partial",
        name: "partial",
        content: "Doc: {{documentTitle}}",
      });
      const main = makeDoc({
        id: "m",
        key: "home",
        name: "Home",
        content: "{% include 'partial' %}",
      });
      const result = processTemplate(
        main.content,
        makeCtx(main, [partial, main])
      );
      expect(result).toBe("Doc: partial");
    });

    it("includes document by key with different name", () => {
      const header = makeDoc({
        id: "header",
        key: "site_header",
        name: "Header",
        content: "# Company Wiki",
      });
      const main = makeDoc({
        id: "main",
        key: "home",
        name: "Home",
        content: "{% include 'site_header' %}\n\nBody content",
      });
      const result = processTemplate(
        main.content,
        makeCtx(main, [header, main])
      );
      expect(result).toBe("# Company Wiki\n\nBody content");
    });

    it("strips frontmatter from included document", () => {
      const included = makeDoc({
        id: "inc",
        key: "included",
        name: "Included",
        content: "---\nid: inc\nname: Included\n---\n\nIncluded body content",
      });
      const main = makeDoc({
        id: "main",
        key: "main",
        name: "Main",
        content: "Before\n{% include 'included' %}\nAfter",
      });
      const result = processTemplate(
        main.content,
        makeCtx(main, [included, main])
      );
      expect(result).toContain("Before");
      expect(result).toContain("Included body content");
      expect(result).toContain("After");
      expect(result).not.toContain("---");
      expect(result).not.toContain("id: inc");
    });
  });

  describe("mixed scenarios", () => {
    it("combines variables, conditionals, and loops", () => {
      const doc = makeDoc({ name: "Report" });
      const template = `# {{documentTitle}}

{% if showAuthor %}Author: {{author}}{% endif %}

## Projects
{% for project in projects %}- {{project}}
{% endfor %}`;

      const result = processTemplate(
        template,
        makeCtx(doc, [doc], {
          showAuthor: true,
          author: "Alice",
          projects: ["Project A", "Project B"],
        })
      );
      expect(result).toContain("# Report");
      expect(result).toContain("Author: Alice");
      expect(result).toContain("- Project A");
      expect(result).toContain("- Project B");
    });

    it("returns plain content unchanged", () => {
      const doc = makeDoc();
      const plain = "# Hello\n\nThis is plain markdown.";
      const result = processTemplate(plain, makeCtx(doc));
      expect(result).toBe(plain);
    });

    it("returns original content on compilation error", () => {
      const doc = makeDoc();
      const broken = "{% if %}unclosed";
      const result = processTemplate(broken, makeCtx(doc));
      expect(result).toBe(broken);
    });
  });
});
