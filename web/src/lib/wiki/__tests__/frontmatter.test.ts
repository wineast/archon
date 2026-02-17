import { describe, expect, it } from "vitest";
import { parseWikiContent, stripFrontmatter } from "../frontmatter";

describe("parseWikiContent", () => {
  it("parses frontmatter with id and title", () => {
    const raw = `---
id: wiki-uw-celebrity
title: GMCC Celebrity 核保标准
---

GMCC Celebrity 核保标准

Some content here.`;

    const result = parseWikiContent(raw);
    expect(result.meta.id).toBe("wiki-uw-celebrity");
    expect(result.meta.title).toBe("GMCC Celebrity 核保标准");
    expect(result.content.trim()).toBe(
      "GMCC Celebrity 核保标准\n\nSome content here."
    );
  });

  it("returns empty meta for content without frontmatter", () => {
    const raw = "# Hello World\n\nSome markdown content.";
    const result = parseWikiContent(raw);
    expect(result.meta).toEqual({});
    expect(result.content).toBe(raw);
  });

  it("handles partial frontmatter (only title)", () => {
    const raw = `---
title: Test Doc
---

Body content.`;

    const result = parseWikiContent(raw);
    expect(result.meta.title).toBe("Test Doc");
    expect(result.meta.id).toBeUndefined();
    expect(result.content.trim()).toBe("Body content.");
  });

  it("handles partial frontmatter (only id)", () => {
    const raw = `---
id: custom-id
---

Body content.`;

    const result = parseWikiContent(raw);
    expect(result.meta.id).toBe("custom-id");
    expect(result.meta.title).toBeUndefined();
    expect(result.content.trim()).toBe("Body content.");
  });

  it("handles empty string", () => {
    const result = parseWikiContent("");
    expect(result.meta).toEqual({});
    expect(result.content).toBe("");
  });

  it("handles extra frontmatter fields", () => {
    const raw = `---
id: doc-1
title: My Doc
tags: [a, b]
---

Content.`;

    const result = parseWikiContent(raw);
    expect(result.meta.id).toBe("doc-1");
    expect(result.meta.title).toBe("My Doc");
    expect(result.meta.tags).toEqual(["a", "b"]);
    expect(result.content.trim()).toBe("Content.");
  });
});

describe("stripFrontmatter", () => {
  it("strips frontmatter and returns body", () => {
    const raw = `---
id: wiki-uw-test
title: Test
---

Body content here.`;

    expect(stripFrontmatter(raw).trim()).toBe("Body content here.");
  });

  it("returns content unchanged when no frontmatter", () => {
    const raw = "# Title\n\nParagraph.";
    expect(stripFrontmatter(raw)).toBe(raw);
  });

  it("returns empty string for empty input", () => {
    expect(stripFrontmatter("")).toBe("");
  });
});
