"use client";

import type { ReactNode } from "react";
import {
  CollapsibleSection,
  InputsSection,
  ResultHeader,
  ResultSection,
  RateSheetLinks,
} from "@/components/tool-result";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export interface BuiltinExample {
  name: string;
  render: () => ReactNode;
}

export interface BuiltinComponentDef {
  key: string;
  name: string;
  description: string;
  examples: BuiltinExample[];
}

export const BUILTIN_COMPONENTS: BuiltinComponentDef[] = [
  {
    key: "collapsible-section",
    name: "CollapsibleSection",
    description:
      "Foldable section with title and optional badge. Supports bordered and borderless modes.",
    examples: [
      {
        name: "Default Collapsed",
        render: () => (
          <div className="max-w-md">
            <CollapsibleSection title="Adjustments" badge={3}>
              <div className="p-3 text-sm text-muted-foreground">
                Three adjustments applied to pricing.
              </div>
            </CollapsibleSection>
          </div>
        ),
      },
      {
        name: "Default Open",
        render: () => (
          <div className="max-w-md">
            <CollapsibleSection title="Rate Details" defaultOpen>
              <div className="p-3 text-sm">
                <p>Base Rate: 6.125%</p>
                <p>Final Rate: 6.125%</p>
              </div>
            </CollapsibleSection>
          </div>
        ),
      },
      {
        name: "Borderless",
        render: () => (
          <div className="max-w-md">
            <CollapsibleSection title="Parameters" defaultOpen borderless>
              <div className="px-3 pb-3 text-sm text-muted-foreground">
                Borderless mode for embedding inside divide-y containers.
              </div>
            </CollapsibleSection>
          </div>
        ),
      },
    ],
  },
  {
    key: "result-header",
    name: "ResultHeader & ResultSection",
    description:
      "Layout primitives for structured tool result cards. ResultHeader renders a title bar, ResultSection wraps content blocks.",
    examples: [
      {
        name: "Header and Section",
        render: () => (
          <div className="max-w-md border rounded-lg divide-y">
            <ResultHeader title="Universe Pricing" />
            <ResultSection>
              <p className="text-sm text-muted-foreground">
                Content goes here inside a ResultSection.
              </p>
            </ResultSection>
          </div>
        ),
      },
    ],
  },
  {
    key: "inputs-section",
    name: "InputsSection",
    description:
      "Collapsible parameter grid displaying input key-value pairs with optional field descriptions shown via tooltip.",
    examples: [
      {
        name: "With Field Descriptions",
        render: () => (
          <div className="max-w-md">
            <InputsSection
              title="Input Parameters"
              args={{
                ficoScore: 720,
                state: "CA",
                isUniverseRefinance: false,
                docSigningLocation: "insideUS",
                lockDays: 30,
              }}
              fieldDescriptions={{
                ficoScore: "Borrower FICO score",
                state: "Property state (NY uses special CRA rate)",
                isUniverseRefinance:
                  "Whether this is a refinance of an existing Universe loan",
                docSigningLocation: "Where documents will be signed",
              }}
            />
          </div>
        ),
      },
    ],
  },
  {
    key: "rate-sheet-links",
    name: "RateSheetLinks",
    description:
      "Displays one or more rate sheet document links. Single sheet shows a direct link; multiple sheets open a popover menu.",
    examples: [
      {
        name: "Single Rate Sheet",
        render: () => (
          <RateSheetLinks
            rateSheets={[
              {
                type: "pdf",
                url: "/products/universe/rate-sheets/GMCC Universe 12-22-2025 Snow.pdf",
                title: "GMCC Universe 12-22-2025 Snow",
              },
            ]}
            onSelect={(sheet) => console.log("Selected:", sheet.title)}
          />
        ),
      },
      {
        name: "Multiple Rate Sheets",
        render: () => (
          <RateSheetLinks
            rateSheets={[
              { type: "pdf", url: "/sheet1.pdf", title: "Rate Sheet v1" },
              {
                type: "pdf",
                url: "/sheet2.pdf",
                title: "Rate Sheet v2 (Updated)",
              },
            ]}
            onSelect={(sheet) => console.log("Selected:", sheet.title)}
          />
        ),
      },
    ],
  },
  {
    key: "badge",
    name: "Badge",
    description:
      "Inline status indicator with multiple color variants.",
    examples: [
      {
        name: "Variants",
        render: () => (
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        ),
      },
    ],
  },
  {
    key: "spinner",
    name: "Spinner",
    description: "Animated loading indicator with customizable size.",
    examples: [
      {
        name: "Default Size",
        render: () => <Spinner />,
      },
      {
        name: "Custom Size",
        render: () => <Spinner className="size-8" />,
      },
    ],
  },
  {
    key: "table",
    name: "Table",
    description:
      "Composite table components with responsive scrolling, hover states, and border styling.",
    examples: [
      {
        name: "Basic Table",
        render: () => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">INV-001</TableCell>
                <TableCell>Paid</TableCell>
                <TableCell className="text-right">$250.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INV-002</TableCell>
                <TableCell>Pending</TableCell>
                <TableCell className="text-right">$150.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INV-003</TableCell>
                <TableCell>Unpaid</TableCell>
                <TableCell className="text-right">$350.00</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ),
      },
    ],
  },
  {
    key: "tooltip",
    name: "Tooltip",
    description:
      "Radix-based tooltip with smooth animation, configurable placement, and arrow indicator.",
    examples: [
      {
        name: "Basic Usage",
        render: () => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  Hover me
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
    ],
  },
];
