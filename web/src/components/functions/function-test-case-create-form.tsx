"use client";

import { useCallback, useState } from "react";
import { SaveIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/editors/json-editor";
import { Spinner } from "@/components/ui/spinner";

interface FunctionTestCaseCreateFormProps {
  onCreate: (data: {
    name: string;
    input: Record<string, unknown>;
    expectedOutput: unknown;
    tags: string[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function FunctionTestCaseCreateForm({
  onCreate,
  onCancel,
}: FunctionTestCaseCreateFormProps) {
  const [name, setName] = useState("");
  const [inputValue, setInputValue] = useState("{}");
  const [expectedOutputValue, setExpectedOutputValue] = useState("");
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
    let expectedOutput: unknown = null;
    if (expectedOutputValue.trim()) {
      try {
        expectedOutput = JSON.parse(expectedOutputValue);
      } catch {
        return;
      }
    }
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), input: parsed, expectedOutput, tags });
    } finally {
      setSaving(false);
    }
  }, [name, inputValue, expectedOutputValue, tags, onCreate]);

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

      {/* Expected Output JSON */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Expected Output
        </label>
        <JsonEditor
          value={expectedOutputValue}
          onChange={setExpectedOutputValue}
          height="100px"
          className="mt-1"
        />
      </div>

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
