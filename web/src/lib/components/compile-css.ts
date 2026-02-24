import { compile } from "@tailwindcss/node";
import { readFileSync } from "fs";
import { join } from "path";

// Cache the compiled design system so we don't re-parse globals.css on every call
let compilerPromise: ReturnType<typeof compile> | null = null;

function getCompiler() {
  if (!compilerPromise) {
    const globalsCss = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf-8"
    );
    compilerPromise = compile(globalsCss, {
      base: process.cwd(),
      onDependency: () => {},
    });
  }
  return compilerPromise;
}

/**
 * Extract potential Tailwind class candidates from component JSX source.
 * Scans for tokens that look like utility classes (e.g. "flex", "p-4", "hover:bg-accent").
 */
export function extractCandidates(source: string): string[] {
  // Match tokens that could be Tailwind classes:
  // letters, digits, hyphens, colons (variants), slashes, dots, brackets, %, !, #
  const tokenRegex = /[a-zA-Z0-9_\-:.\/\[\]%#!]+/g;
  const tokens = new Set<string>();
  let match;
  while ((match = tokenRegex.exec(source)) !== null) {
    const token = match[0];
    // Skip tokens that are clearly not CSS classes
    if (/^\d/.test(token)) continue; // starts with digit
    if (token.length < 2) continue; // single char
    if (/^(true|false|null|undefined|return|function|const|let|var|if|else|for|while|switch|case|break|continue|this|new|typeof|instanceof|import|export|default|class|extends|try|catch|finally|throw|void|delete|in|of|do|with|yield|async|await|from|as|get|set)$/.test(token)) continue; // JS keywords
    tokens.add(token);
  }
  return [...tokens];
}

/**
 * Extract only the utility rules and @property declarations from full Tailwind output.
 * Strips theme variables, base layer, :root/:dark blocks, and the @layer utilities
 * wrapper itself — only the inner rules are kept. This avoids creating duplicate
 * @layer utilities blocks when injected into a page that already has global Tailwind.
 */
export function extractUtilityCss(fullCss: string): string {
  const parts: string[] = [];

  // Extract inner content of @layer utilities { ... } — strip the wrapper
  const utilitiesMatch = fullCss.match(/@layer utilities \{/);
  if (utilitiesMatch && utilitiesMatch.index !== undefined) {
    const innerStart = utilitiesMatch.index + utilitiesMatch[0].length;
    let depth = 1; // we're already inside the opening brace
    let innerEnd = innerStart;
    for (let i = innerStart; i < fullCss.length; i++) {
      if (fullCss[i] === "{") depth++;
      if (fullCss[i] === "}") {
        depth--;
        if (depth === 0) {
          innerEnd = i;
          break;
        }
      }
    }
    const inner = fullCss.slice(innerStart, innerEnd).trim();
    if (inner) parts.push(inner);
  }

  // Extract @property declarations (needed for CSS variable fallbacks)
  const propertyRegex = /@property\s+--tw-[^{]+\{[^}]+\}/g;
  let propMatch;
  while ((propMatch = propertyRegex.exec(fullCss)) !== null) {
    parts.push(propMatch[0]);
  }

  return parts.join("\n");
}

/**
 * Compile Tailwind CSS for a component's JSX source.
 * Returns only the utility classes and @property declarations needed.
 */
export async function compileCssForComponent(
  componentSource: string
): Promise<string> {
  if (!componentSource.trim()) return "";

  const candidates = extractCandidates(componentSource);
  if (candidates.length === 0) return "";

  const compiler = await getCompiler();
  const fullCss = compiler.build(candidates);

  return extractUtilityCss(fullCss);
}
