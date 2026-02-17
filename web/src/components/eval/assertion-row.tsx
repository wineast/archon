"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Assertion, AssertionType } from "@/lib/eval/types";
import { Trash2Icon } from "lucide-react";

const ASSERTION_TYPES: { value: AssertionType; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "not-contains", label: "Not Contains" },
  { value: "regex", label: "Regex" },
  { value: "length-min", label: "Min Length" },
  { value: "length-max", label: "Max Length" },
  { value: "json-valid", label: "JSON Valid" },
];

interface AssertionRowProps {
  assertion: Assertion;
  onChange: (updated: Assertion) => void;
  onDelete: () => void;
}

export function AssertionRow({ assertion, onChange, onDelete }: AssertionRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={assertion.type}
        onValueChange={(value: AssertionType) =>
          onChange({ ...assertion, type: value })
        }
      >
        <SelectTrigger className="w-[140px]" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASSERTION_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {assertion.type !== "json-valid" && (
        <Input
          className="h-8 flex-1 text-sm"
          value={assertion.value}
          onChange={(e) => onChange({ ...assertion, value: e.target.value })}
          placeholder={
            assertion.type === "regex"
              ? "e.g. \\d+"
              : assertion.type === "length-min" || assertion.type === "length-max"
                ? "e.g. 100"
                : "value..."
          }
        />
      )}
      {assertion.type === "json-valid" && <div className="flex-1" />}
      <Button variant="ghost" size="sm" onClick={onDelete} className="size-8 p-0">
        <Trash2Icon className="size-3.5" />
      </Button>
    </div>
  );
}
