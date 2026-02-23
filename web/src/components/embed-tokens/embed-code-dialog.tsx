"use client";

import { useCallback, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  token: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2 size-7"
      onClick={handleCopy}
    >
      {copied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </Button>
  );
}

export function EmbedCodeDialog({
  open,
  onOpenChange,
  agentId,
  token,
}: EmbedCodeDialogProps) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  const basicCode = `<script
  src="${origin}/embed/widget.js"
  data-agent-id="${agentId}"
  data-token="${token}"
></script>`;

  const hostCode = `<script
  src="${origin}/embed/widget.js"
  data-agent-id="${agentId}"
  data-token="${token}"
></script>

<script>
  // 注入宿主上下文 → 系统提示词模板变量 {{ host.xxx }}
  ArchonEmbed.setContext({
    currentPage: location.pathname,
    userName: '张三',
    userRole: 'premium'
  });

  // 注册宿主工具 Handler → AI 可调用
  // 工具需在 Dashboard Tools 中定义，executionTarget 设为 Host
  ArchonEmbed.registerTools({
    addToCart: async ({ productId, quantity }) => {
      // 执行宿主页面逻辑
      const result = await myApp.cart.add(productId, quantity);
      // 更新上下文让 AI 知道最新状态
      ArchonEmbed.setContext({ cartItems: result.cartSize });
      return { success: true, cartSize: result.cartSize };
    }
  });
</script>`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Embed Code</DialogTitle>
          <DialogDescription>
            Copy the code below and paste it into your website&apos;s HTML.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="basic">
          <TabsList className="h-7">
            <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
            <TabsTrigger value="host" className="text-xs">Host Integration</TabsTrigger>
          </TabsList>
          <TabsContent value="basic" className="mt-3 space-y-3">
            <div className="relative">
              <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">
                <code>{basicCode}</code>
              </pre>
              <CopyButton text={basicCode} />
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Optional attributes:</p>
              <ul className="list-inside list-disc space-y-1">
                <li><code>data-position</code> — bottom-right (default), bottom-left, top-right, top-left</li>
                <li><code>data-button-color</code> — CSS color for the chat button</li>
                <li><code>data-width</code> / <code>data-height</code> — Chat window size in px</li>
              </ul>
            </div>
          </TabsContent>
          <TabsContent value="host" className="mt-3 space-y-3">
            <div className="relative">
              <pre className="max-h-80 rounded-md bg-muted p-4 text-xs overflow-auto">
                <code>{hostCode}</code>
              </pre>
              <CopyButton text={hostCode} />
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Host Integration APIs:</p>
              <ul className="list-inside list-disc space-y-1">
                <li><code>ArchonEmbed.setContext(data)</code> — 注入宿主上下文，在系统提示词中通过 <code>{"{{ host.xxx }}"}</code> 引用</li>
                <li><code>ArchonEmbed.registerTools(handlers)</code> — 注册宿主工具 Handler，工具需在 Dashboard 中定义</li>
                <li><code>ArchonEmbed.open()</code> / <code>.close()</code> — 程序化控制聊天窗口</li>
                <li><code>ArchonEmbed.on(event, cb)</code> — 监听事件：ready, open, close, message</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
