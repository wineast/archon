"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserCogIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useCallback, useEffect, useState } from "react";

interface UserProfile {
  nickname: string;
  bio: string;
}

interface UserSettingsModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UserSettingsModal({ open: controlledOpen, onOpenChange }: UserSettingsModalProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UserProfile>({ nickname: "", bio: "" });

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user");
      const data = await res.json();
      if (data) {
        setDraft({
          nickname: data.nickname ?? "",
          bio: data.bio ?? "",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchProfile();
    }
  }, [open, fetchProfile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }, [draft]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <UserCogIcon className="mr-1.5 size-4" />
            Settings
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Settings</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Nickname</label>
              <Input
                value={draft.nickname}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, nickname: e.target.value }))
                }
                placeholder="Enter your nickname..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Bio</label>
              <Textarea
                value={draft.bio}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, bio: e.target.value }))
                }
                placeholder="Tell us about yourself..."
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? <Spinner className="mr-1.5 size-4" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
