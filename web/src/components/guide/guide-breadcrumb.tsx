"use client";

import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link, usePathname } from "@/i18n/navigation";
import type { GuideNavItem } from "./guide-nav-config";

interface GuideBreadcrumbProps {
  items: GuideNavItem[];
}

function findTitle(items: GuideNavItem[], slug: string): string | undefined {
  for (const item of items) {
    if (item.slug === slug) return item.title;
  }
  return undefined;
}

export function GuideBreadcrumb({ items }: GuideBreadcrumbProps) {
  const pathname = usePathname();

  // pathname is locale-stripped, e.g. "/guide/tools/create-tool"
  const guidePrefix = "/guide";
  const rest = pathname.startsWith(guidePrefix)
    ? pathname.slice(guidePrefix.length).replace(/^\//, "")
    : "";

  if (!rest) return null;

  const segments = rest.split("/");
  const crumbs: { label: string; href: string }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const slug = segments.slice(0, i + 1).join("/");
    const label = findTitle(items, slug) ?? segments[i];
    crumbs.push({ label, href: `/guide/${slug}` });
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
