import fs from "fs";
import path from "path";

export interface GuideNavItem {
  title: string;
  slug: string;
}

export interface GuideNavGroup {
  group: string;
  items: GuideNavItem[];
}

const GUIDE_DIR = path.join(process.cwd(), "guide");

interface SiteEntry {
  group: string;
  items: string[];
}

/** Extract the first H1 title from a markdown file */
function extractH1(slug: string): string {
  const filePath = path.join(GUIDE_DIR, `${slug}.md`);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : slug;
  } catch {
    return slug;
  }
}

/**
 * Read site.json and build grouped nav items.
 * Titles are extracted from each markdown file's H1 heading.
 */
export function getGuideNavGroups(): GuideNavGroup[] {
  const sitePath = path.join(GUIDE_DIR, "site.json");
  const entries: SiteEntry[] = JSON.parse(fs.readFileSync(sitePath, "utf-8"));

  return entries.map((entry) => ({
    group: entry.group,
    items: entry.items.map((slug) => ({
      title: extractH1(slug),
      slug,
    })),
  }));
}

/** Flat list of all nav items (for breadcrumb lookup) */
export function getGuideNavItems(): GuideNavItem[] {
  return getGuideNavGroups().flatMap((g) => g.items);
}
