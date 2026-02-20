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
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
interface MemoryCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    type: string;
    content: string;
    userId?: string | null;
    importance?: number;
  }) => Promise<void>;
  allTypes: string[];
}

export function MemoryCreateDialog({
  open,
  onOpenChange,
  onCreate,
  allTypes,
}: MemoryCreateDialogProps) {
  const [type, setType] = useState<string>("fact");
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState("");
  const [importance, setImportance] = useState(0.5);
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!content.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        type,
        content: content.trim(),
        userId: userId.trim() || null,
        importance,
      });
      setType("fact");
      setContent("");
      setUserId("");
      setImportance(0.5);
    } finally {
      setCreating(false);
    }
  }, [type, content, userId, importance, onCreate]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setType("fact");
        setContent("");
        setUserId("");
        setImportance(0.5);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const canSubmit = content.trim().length > 0 && !creating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Memory</DialogTitle>
          <DialogDescription>
            Create a new memory entry for the agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Content
            </label>
            <Textarea
              className="mt-1 text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Memory content..."
              rows={3}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              User ID (optional)
            </label>
            <Input
              className="mt-1 h-8 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Leave empty for global memory"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Importance: {(importance * 100).toFixed(0)}%
            </label>
            <Slider
              className="mt-2"
              value={[importance]}
              onValueChange={([v]) => setImportance(v)}
              min={0}
              max={1}
              step={0.05}
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
