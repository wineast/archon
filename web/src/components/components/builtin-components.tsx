"use client";

import type { ReactNode } from "react";
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
