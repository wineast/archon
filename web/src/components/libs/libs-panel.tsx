"use client";

import { useState } from "react";
import { ArrowLeftIcon, LibraryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LibsSidebar } from "./libs-sidebar";
import { LibDetail } from "./lib-detail";
import libsData from "@/db/builtins/libs.json";

export interface LibParam {
  name: string;
  type: string;
  description: string;
}

export interface LibEntry {
  key: string;
  name: string;
  description: string;
  importExample: string;
  signature: string;
  parameters: LibParam[];
  returns: string;
}

const libs: LibEntry[] = libsData as LibEntry[];

export function LibsPanel() {
  const [activeKey, setActiveKey] = useState<string | null>(
    libs.length > 0 ? libs[0].key : null
  );
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");

  const activeLib = libs.find((l) => l.key === activeKey) ?? null;

  function handleSelect(key: string) {
    setActiveKey(key);
    setMobileView("detail");
  }

  function renderDetail() {
    if (activeLib) {
      return <LibDetail lib={activeLib} />;
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <LibraryIcon className="size-12 opacity-30" />
        <span className="text-sm">Select a lib to view details</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop */}
      <div className="hidden h-full sm:flex">
        <LibsSidebar libs={libs} activeKey={activeKey} onSelect={handleSelect} />
      </div>
      <div className="hidden flex-1 overflow-hidden sm:flex">
        {renderDetail()}
      </div>

      {/* Mobile */}
      <div className="flex h-full w-full flex-col sm:hidden">
        {mobileView === "sidebar" ? (
          <LibsSidebar libs={libs} activeKey={activeKey} onSelect={handleSelect} />
        ) : (
          <>
            <div className="flex h-10 items-center gap-2 border-b px-3">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => setMobileView("sidebar")}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <span className="text-sm font-medium">{activeLib?.name}</span>
            </div>
            {renderDetail()}
          </>
        )}
      </div>
    </div>
  );
}
