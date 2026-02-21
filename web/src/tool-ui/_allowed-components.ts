import React, { useState, useMemo, useCallback, useEffect, useRef, Fragment } from "react";
import { ChevronRight, FileText } from "lucide-react";
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
import {
  CollapsibleSection,
  RateSheetLinks,
  RateSheetPanel,
  SourceDocumentViewer,
  ResultHeader,
  ResultSection,
} from "@/components/tool-result";

// Available dependency registry for dynamically compiled components.
// These deps are passed as a single object to the outer closure;
// user code destructures only the deps it needs: function Component({ React, useState, ... }).
export const INJECTED_DEPS: Record<string, unknown> = {
  // React core
  React,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  Fragment,
  // UI components
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
  ResultHeader,
  ResultSection,
  RateSheetLinks,
  RateSheetPanel,
  SourceDocumentViewer,
  // Lucide icons
  ChevronRight,
  FileText,
};

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
    ResultHeader,
    ResultSection,
    RateSheetLinks,
    RateSheetPanel,
    SourceDocumentViewer,
  },
  "archon:icons": {
    ChevronRight,
    FileText,
  },
};
