import React, { useState, useMemo, useCallback, useEffect, useRef, Fragment } from "react";
import {
  ChevronRight,
  ChevronDownIcon,
  FileText,
  WrenchIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CircleIcon,
} from "lucide-react";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Module-keyed dependency registry for ES module format components.
// Maps `archon:*` module specifiers to their export objects.
export const INJECTED_DEPS_BY_MODULE: Record<string, Record<string, unknown>> = {
  "archon:react": {
    default: React,
    React,
    useState,
    useMemo,
    useCallback,
    useEffect,
    useRef,
    Fragment,
  },
  "archon:ui": {
    Badge,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    CollapsibleSection,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    Popover,
    PopoverContent,
    PopoverTrigger,
  },
  "archon:icons": {
    ChevronRight,
    ChevronDownIcon,
    FileText,
    WrenchIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
    CircleIcon,
  },
};
