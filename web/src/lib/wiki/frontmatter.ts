import matter from "gray-matter";

export interface WikiMeta {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface ParsedWikiContent {
  meta: WikiMeta;
  content: string;
}

/**
 * Parse wiki content that may contain YAML frontmatter.
 * Returns the parsed metadata and the body content (without frontmatter).
 * Safe to call on content without frontmatter — returns empty meta and original content.
 */
export function parseWikiContent(raw: string): ParsedWikiContent {
  if (!raw) return { meta: {}, content: "" };

  const { data, content } = matter(raw);
  return {
    meta: data as WikiMeta,
    content,
  };
}

/**
 * Strip YAML frontmatter from wiki content, returning only the body.
 * Convenience wrapper around parseWikiContent.
 */
export function stripFrontmatter(raw: string): string {
  return parseWikiContent(raw).content;
}

/**
 * Derive a display name from wiki content.
 * Priority: frontmatter `name` → first line of body (stripped of `#` prefix) → "Untitled".
 */
export function resolveName(content: string): string {
  const { meta, content: body } = parseWikiContent(content);
  const firstLine = body.split("\n")[0]?.trim().replace(/^#+\s*/, "") || "";
  return meta.name || firstLine || "Untitled";
}
