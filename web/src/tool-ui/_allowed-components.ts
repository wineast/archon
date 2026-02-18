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

// Dependencies injected into dynamically compiled components via new Function().
// Keys become parameter names in the factory function.
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
