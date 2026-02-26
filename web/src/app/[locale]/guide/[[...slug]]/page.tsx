import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { GuideBreadcrumb } from "@/components/guide/guide-breadcrumb";
import { GuideContent } from "@/components/guide/guide-content";
import { getGuideNavItems } from "@/components/guide/guide-nav-config";

const GUIDE_DIR = path.join(process.cwd(), "guide");

function loadMarkdown(slug: string): string | null {
  // Try exact file, then index.md inside directory
  const candidates = [
    path.join(GUIDE_DIR, `${slug}.md`),
    path.join(GUIDE_DIR, slug, "index.md"),
    path.join(GUIDE_DIR, slug, "README.md"),
  ];

  for (const filePath of candidates) {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      // file not found, try next
    }
  }

  return null;
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug?: string[] }>;
}) {
  const { slug } = await params;
  const slugStr = slug?.join("/") || "";

  // No slug → README.md (home page), otherwise try {slug}.md or {slug}/index.md
  const content = slugStr ? loadMarkdown(slugStr) : loadMarkdown("README");

  if (!content) {
    notFound();
  }

  const items = getGuideNavItems();

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <GuideBreadcrumb items={items} />
      </header>
      <main className="flex-1 overflow-auto p-6">
        <GuideContent content={content} />
      </main>
    </>
  );
}
