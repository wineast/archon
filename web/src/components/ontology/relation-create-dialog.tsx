"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { ObjectTypeRow } from "@/db/schema";

function formatKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function keyToName(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const RELATION_TYPES = [
  { value: "has_one", label: "Has One" },
  { value: "has_many", label: "Has Many" },
  { value: "belongs_to", label: "Belongs To" },
  { value: "many_to_many", label: "Many to Many" },
] as const;

interface RelationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    key: string;
    name: string;
    targetTypeId: string;
    relationType: string;
    inverseName: string;
  }) => Promise<void>;
  objectTypes: ObjectTypeRow[];
  sourceTypeId: string;
}

export function RelationCreateDialog({
  open,
  onOpenChange,
  onCreate,
  objectTypes,
  sourceTypeId,
}: RelationCreateDialogProps) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [targetTypeId, setTargetTypeId] = useState("");
  const [relationType, setRelationType] = useState("has_many");
  const [inverseName, setInverseName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatKey(e.target.value);
      setKey(formatted);
      if (!nameManuallyEdited) {
        setName(keyToName(formatted));
      }
    },
    [nameManuallyEdited]
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
      setNameManuallyEdited(true);
    },
    []
  );

  const handleCreate = useCallback(async () => {
    if (!key.trim() || !targetTypeId) return;
    setCreating(true);
    try {
      await onCreate({
        key: key.trim(),
        name: name.trim() || keyToName(key.trim()),
        targetTypeId,
        relationType,
        inverseName: inverseName.trim(),
      });
      setKey("");
      setName("");
      setNameManuallyEdited(false);
      setTargetTypeId("");
      setRelationType("has_many");
      setInverseName("");
    } finally {
      setCreating(false);
    }
  }, [key, name, targetTypeId, relationType, inverseName, onCreate]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setKey("");
        setName("");
        setNameManuallyEdited(false);
        setTargetTypeId("");
        setRelationType("has_many");
        setInverseName("");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const canSubmit = key.trim().length > 0 && targetTypeId && !creating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Relation</DialogTitle>
          <DialogDescription>
            Define a relationship from this object type to another.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Key
            </label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={key}
              onChange={handleKeyChange}
              placeholder="e.g. applies_for"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              className="mt-1 h-8 text-sm"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Applies For"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Target Type
            </label>
            <Select value={targetTypeId} onValueChange={setTargetTypeId}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue placeholder="Select target type" />
              </SelectTrigger>
              <SelectContent>
                {objectTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Relation Type
            </label>
            <Select value={relationType} onValueChange={setRelationType}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATION_TYPES.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Inverse Name
            </label>
            <Input
              className="mt-1 h-8 text-sm"
              value={inverseName}
              onChange={(e) => setInverseName(e.target.value)}
              placeholder="e.g. Applied By"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {creating && <Spinner className="mr-1.5 size-3" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
