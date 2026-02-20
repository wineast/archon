"use client";

import { GuideDialog } from "@/components/ui/guide-dialog";
import helpDoc from "../../../guide/component-authoring.md";

export function ComponentHelpButton() {
  return <GuideDialog title="组件编写指南" content={helpDoc} />;
}
