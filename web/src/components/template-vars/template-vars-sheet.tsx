"use client";

import { useCallback, useState } from "react";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useTemplateVarRows,
  createTemplateVar,
  updateTemplateVar,
  deleteTemplateVar,
} from "@/lib/template-vars/hooks";

type VarType = "text" | "number" | "boolean" | "json";

/** Try to pretty-print a JSON string; return as-is on failure. */
function tryFormatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

const VAR_TYPES: { value: VarType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "json", label: "JSON" },
];

/**
 * Convert list display value (one item per line) to JSON array string for storage.
 */
function listDisplayToValue(display: string): string {
  const items = display
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}

/**
 * Convert stored JSON array string to display format (one item per line).
 */
function listValueToDisplay(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join("\n");
  } catch {
    // fallback
  }
  return value;
}

function ValueEditor({
  type,
  isArray,
  value,
  onChange,
  disabled,
}: {
  type: VarType;
  isArray: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  if (isArray && type !== "json") {
    return (
      <Textarea
        className="flex-1 min-h-[60px] font-mono text-xs"
        placeholder={"item1\nitem2\nitem3"}
        value={listValueToDisplay(value)}
        onChange={(e) => onChange(listDisplayToValue(e.target.value))}
        disabled={disabled}
      />
    );
  }

  if (isArray && type === "json") {
    return (
      <CodeEditor
        value={value}
        onChange={disabled ? undefined : onChange}
        language="json"
        readOnly={disabled}
        height="120px"
      />
    );
  }

  switch (type) {
    case "boolean":
      return (
        <div className="flex flex-1 items-center">
          <Switch
            checked={value === "true"}
            onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
            disabled={disabled}
          />
          <span className="ml-2 text-sm text-muted-foreground">
            {value === "true" ? "true" : "false"}
          </span>
        </div>
      );
    case "number":
      return (
        <Input
          className="flex-1"
          type="number"
          step="any"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
    case "json":
      return (
        <CodeEditor
          value={value}
          onChange={disabled ? undefined : onChange}
          language="json"
          readOnly={disabled}
          height="120px"
        />
      );
    default:
      return (
        <Input
          className="flex-1"
          placeholder="value"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
  }
}

function VarRow({
  id,
  initialKey,
  initialValue,
  initialType,
  initialIsArray,
  initialDescription,
  busy,
  onBusy,
  mutate,
}: {
  id: string;
  initialKey: string;
  initialValue: string;
  initialType: VarType;
  initialIsArray: boolean;
  initialDescription: string | null;
  busy: boolean;
  onBusy: (b: boolean) => void;
  mutate: () => void;
}) {
  const [key, setKey] = useState(initialKey);
  const [value, setValue] = useState(() =>
    initialType === "json" ? tryFormatJson(initialValue) : initialValue
  );
  const [type, setType] = useState<VarType>(initialType);
  const [isArray, setIsArray] = useState(initialIsArray);
  const [description, setDescription] = useState(initialDescription ?? "");
  // Compare formatted value against formatted initial to avoid false dirty
  const formattedInitial = initialType === "json" ? tryFormatJson(initialValue) : initialValue;
  const dirty =
    key !== initialKey ||
    value !== formattedInitial ||
    type !== initialType ||
    isArray !== initialIsArray ||
    description !== (initialDescription ?? "");

  const handleSave = useCallback(async () => {
    onBusy(true);
    // Compact JSON before saving to DB
    let saveValue = value;
    if (type === "json") {
      try { saveValue = JSON.stringify(JSON.parse(value)); } catch { /* keep as-is */ }
    }
    await updateTemplateVar(id, { key, value: saveValue, type, isArray, description: description || null }, mutate);
    onBusy(false);
  }, [id, key, value, type, isArray, description, mutate, onBusy]);

  const handleDelete = useCallback(async () => {
    onBusy(true);
    await deleteTemplateVar(id, mutate);
    onBusy(false);
  }, [id, mutate, onBusy]);

  const handleTypeChange = useCallback(
    (newType: VarType) => {
      setType(newType);
      if (isArray) {
        setValue("[]");
      } else if (newType === "boolean") {
        setValue("false");
      } else if (newType === "json") {
        setValue("{}");
      } else if (newType === "number") {
        setValue("0");
      } else {
        setValue(value);
      }
    },
    [value, isArray]
  );

  const handleIsArrayChange = useCallback(
    (checked: boolean) => {
      setIsArray(checked);
      if (checked) {
        setValue("[]");
      } else {
        // Reset to scalar default
        if (type === "boolean") setValue("false");
        else if (type === "json") setValue("{}");
        else if (type === "number") setValue("0");
        else setValue("");
      }
    },
    [type]
  );

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Input
          className="w-36 shrink-0"
          placeholder="key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={busy}
        />
        <Select
          value={type}
          onValueChange={(v) => handleTypeChange(v as VarType)}
          disabled={busy}
        >
          <SelectTrigger className="w-28 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VAR_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={isArray}
            onCheckedChange={handleIsArrayChange}
            disabled={busy}
          />
          <span className="text-xs text-muted-foreground">Array</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={busy || !dirty || !key.trim()}
          onClick={handleSave}
        >
          {busy ? (
            <Spinner className="size-4" />
          ) : (
            <SaveIcon className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          onClick={handleDelete}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
      <Input
        className="text-xs text-muted-foreground"
        placeholder="描述（可选）"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={busy}
      />
      <ValueEditor
        type={type}
        isArray={isArray}
        value={value}
        onChange={setValue}
        disabled={busy}
      />
    </div>
  );
}

export function TemplateVarsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { rows, mutate } = useTemplateVarRows();
  const [busy, setBusy] = useState(false);

  const handleAdd = useCallback(async () => {
    setBusy(true);
    await createTemplateVar({ key: "", value: "", type: "text" }, mutate);
    setBusy(false);
  }, [mutate]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-4xl"
      >
        <SheetTitle className="sr-only">Template Variables</SheetTitle>
        <SheetDescription className="sr-only">
          Manage key-value template variables
        </SheetDescription>

        <div className="flex items-center px-4 py-3">
          <h2 className="text-sm font-medium">Variables</h2>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-2 p-4">
            {rows.length === 0 && (
              <p className="text-muted-foreground text-center text-sm py-8">
                No variables yet. Click Add to create one.
              </p>
            )}
            {rows.map((row) => (
              <VarRow
                key={row.id}
                id={row.id}
                initialKey={row.key}
                initialValue={row.value}
                initialType={(row.type as VarType) ?? "text"}
                initialIsArray={row.isArray ?? false}
                initialDescription={row.description}
                busy={busy}
                onBusy={setBusy}
                mutate={mutate}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="px-4 py-3">
          <Button size="sm" variant="outline" disabled={busy} onClick={handleAdd} className="w-full">
            {busy ? <Spinner className="size-4" /> : <PlusIcon className="size-4" />}
            Add
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
