"use client";

import { useState, useCallback, useEffect } from "react";
import { Share2Icon, CopyIcon, CheckIcon, XIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ShareButtonProps {
  sessionId: string | undefined;
  shareId?: string | null;
  onShareChange?: (shareId: string | null) => void;
}

export function ShareButton({
  sessionId,
  shareId: externalShareId,
  onShareChange,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localShareId, setLocalShareId] = useState<string | null>(
    externalShareId ?? null
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (externalShareId !== undefined) {
      setLocalShareId(externalShareId);
    }
  }, [externalShareId]);

  const shareId = localShareId;

  const shareUrl = shareId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareId}`
    : null;

  const handleShare = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/share`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setLocalShareId(data.shareId);
        onShareChange?.(data.shareId);
      }
    } catch (error) {
      console.error("Failed to share:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, onShareChange]);

  const handleUnshare = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/share`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLocalShareId(null);
        onShareChange?.(null);
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to unshare:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, onShareChange]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [shareUrl]);

  if (!sessionId) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={shareId ? "已分享" : "分享对话"}
          className={`size-8 ${shareId ? "text-primary" : ""}`}
        >
          <Share2Icon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        {shareId ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">分享链接</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnshare}
                disabled={isLoading}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                {isLoading ? (
                  <Spinner className="mr-1 size-3" />
                ) : (
                  <XIcon className="mr-1 size-3" />
                )}
                取消分享
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl || ""}
                className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="复制链接"
              >
                {copied ? (
                  <CheckIcon className="size-4 text-green-500" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              任何人都可以通过此链接查看对话内容
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-medium">分享对话</div>
            <p className="text-xs text-muted-foreground">
              创建公开链接，任何人无需登录即可查看对话内容
            </p>
            <Button
              onClick={handleShare}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  创建中...
                </>
              ) : (
                <>
                  <Share2Icon className="mr-2 size-4" />
                  创建链接
                </>
              )}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
