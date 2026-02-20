"use client";

import { useCallback, useState } from "react";
import { MinusCircleIcon, PlusIcon, SaveIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/editors/json-editor";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

interface SchemaTestCaseCreateFormProps {
  onCreate: (data: {
    name: string;
    input: Record<string, unknown>;
    shouldPass: boolean;
    expectedErrors?: Array<{ path: string; message: string }>;
    tags: string[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function SchemaTestCaseCreateForm({
  onCreate,
  onCancel,
}: SchemaTestCaseCreateFormProps) {
  const [name, setName] = useState("");
  const [inputValue, setInputValue] = useState("{}");
  const [shouldPass, setShouldPass] = useState(true);
  const [expectedErrors, setExpectedErrors] = useState<
    Array<{ path: string; message: string }>
  >([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(inputValue);
    } catch {
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        input: parsed,
        shouldPass,
        expectedErrors: !shouldPass && expectedErrors.length > 0 ? expectedErrors : undefined,
        tags,
      });
    } finally {
      setSaving(false);
    }
  }, [name, inputValue, shouldPass, expectedErrors, tags, onCreate]);

  const handleAddTag = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setTagInput("");
    },
    [tags]
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag(tagInput);
      }
    },
    [tagInput, handleAddTag]
  );

  const handleAddExpectedError = useCallback(() => {
    setExpectedErrors([...expectedErrors, { path: "", message: "" }]);
  }, [expectedErrors]);

  const handleRemoveExpectedError = useCallback(
    (index: number) => {
      setExpectedErrors(expectedErrors.filter((_, i) => i !== index));
    },
    [expectedErrors]
  );

  const handleUpdateExpectedError = useCallback(
    (index: number, field: "path" | "message", value: string) => {
      setExpectedErrors(
        expectedErrors.map((err, i) =>
          i === index ? { ...err, [field]: value } : err
        )
      );
    },
    [expectedErrors]
  );

  return (
    <div className="space-y-3">
      {/* Name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input
          className="mt-1 h-8 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Test case name"
          autoFocus
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Tags</label>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 text-xs">
              {tag}
              <button
                type="button"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <Input
            className="h-6 min-w-[80px] flex-1 border-none px-1 text-xs shadow-none focus-visible:ring-0"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => tagInput.trim() && handleAddTag(tagInput)}
            placeholder="Add tag..."
          />
        </div>
      </div>

      {/* Input JSON */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Input
        </label>
        <JsonEditor
          value={inputValue}
          onChange={setInputValue}
          height="100px"
          className="mt-1"
        />
      </div>

      {/* Should Pass */}
      <div className="flex items-center gap-2">
        <Switch
          checked={shouldPass}
          onCheckedChange={setShouldPass}
        />
        <Label className="text-xs">
          {shouldPass ? "Should be valid" : "Should be invalid"}
        </Label>
      </div>

      {/* Expected Errors (only when shouldPass=false) */}
      {!shouldPass && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Expected Errors
          </label>
          <div className="mt-1 space-y-2">
            {expectedErrors.map((err, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="h-7 flex-1 text-xs font-mono"
                  value={err.path}
                  onChange={(e) =>
                    handleUpdateExpectedError(i, "path", e.target.value)
                  }
                  placeholder="path (e.g. name)"
                />
                <Input
                  className="h-7 flex-[2] text-xs"
                  value={err.message}
                  onChange={(e) =>
                    handleUpdateExpectedError(i, "message", e.target.value)
                  }
                  placeholder="message substring"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveExpectedError(i)}
                >
                  <MinusCircleIcon className="size-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={handleAddExpectedError}
            >
              <PlusIcon className="size-3" />
              Add Error
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="gap-1"
        >
          {saving ? <Spinner className="size-3" /> : <SaveIcon className="size-3" />}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
