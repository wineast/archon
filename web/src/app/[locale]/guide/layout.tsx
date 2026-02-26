import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GuideSidebar } from "@/components/guide/guide-sidebar";
import { getGuideNavGroups } from "@/components/guide/guide-nav-config";

export default async function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const groups = getGuideNavGroups();

  return (
    <SidebarProvider>
      <GuideSidebar groups={groups} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
