"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrgCredits, purchaseCredits } from "@/lib/orgs/credits-hooks";
import { PlusIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function formatCost(cost: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(cost);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PRESET_AMOUNTS = [10, 50, 100, 500] as const;

function PurchaseDialog({
  orgId,
  open,
  onOpenChange,
  mutate,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutate: ReturnType<typeof useOrgCredits>["mutate"];
}) {
  const [selected, setSelected] = useState<number>(PRESET_AMOUNTS[0]);
  const [busy, setBusy] = useState(false);

  async function handlePurchase() {
    setBusy(true);
    const ok = await purchaseCredits(orgId, selected, mutate);
    setBusy(false);
    if (ok) {
      toast.success("充值成功");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>充值额度</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {PRESET_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setSelected(amt)}
              className={cn(
                "rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors",
                selected === amt
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              )}
            >
              ${amt}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handlePurchase} disabled={busy} className="w-full">
            {busy ? <Spinner className="size-4" /> : `确认支付 $${selected}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrgCreditsPanel({ orgId }: { orgId: string }) {
  const { balance, transactions, isLoading, mutate } = useOrgCredits(orgId);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Balance Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <WalletIcon className="size-4 text-muted-foreground" />
                当前余额
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPurchaseOpen(true)}
              >
                <PlusIcon className="size-3.5" />
                充值
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold tracking-tight">{formatCost(balance)}</div>
            {balance <= 0 && (
              <Badge variant="destructive" className="text-xs">额度已用完</Badge>
            )}
            {balance > 0 && balance <= 5 && (
              <Badge variant="outline" className="border-yellow-500/50 text-xs text-yellow-600">额度即将用完</Badge>
            )}
          </CardContent>
        </Card>

        <PurchaseDialog
          orgId={orgId}
          open={purchaseOpen}
          onOpenChange={setPurchaseOpen}
          mutate={mutate}
        />

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">充值记录</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无充值记录
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead className="text-right">余额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">
                        {formatDate(tx.createdAt as unknown as string)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono",
                          tx.amount > 0 ? "text-green-600" : "text-red-500"
                        )}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {formatCost(tx.amount)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {tx.type === "purchase" ? "购买" : tx.type === "topup" ? "充值" : "调整"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tx.description || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCost(tx.balanceAfter)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
