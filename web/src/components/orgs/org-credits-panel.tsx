"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useOrgCredits } from "@/lib/orgs/credits-hooks";
import { InfoIcon, WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function OrgCreditsPanel({ orgId }: { orgId: string }) {
  const { balance, transactions, isLoading } = useOrgCredits(orgId);

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
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <WalletIcon className="size-4 text-muted-foreground" />
              当前余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{formatCost(balance)}</div>
          </CardContent>
        </Card>

        {/* BYOK Notice */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/50">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-blue-500" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">充值功能暂未开放</p>
            <p className="text-blue-700 dark:text-blue-300">
              请前往 <span className="font-medium">设置 → API Keys</span> 配置你自己的 Provider Key 来使用 AI 对话功能。
            </p>
          </div>
        </div>

        {/* Transaction History */}
        {transactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">充值记录</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
