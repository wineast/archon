"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ShieldIcon, ShieldOffIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAdminUsers, updateUserRole } from "@/lib/admin/hooks";

export default function AdminPage() {
  const { users, isLoading, mutate } = useAdminUsers();
  const [busy, setBusy] = useState(false);

  const handleToggleRole = useCallback(
    async (userId: string, current: string) => {
      setBusy(true);
      await updateUserRole(
        userId,
        current === "super_admin" ? "user" : "super_admin",
        mutate
      );
      setBusy(false);
    },
    [mutate]
  );

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-6">
        <Link href="/">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">管理后台</h1>
      </header>

      <main className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              用户列表 ({users.length})
            </h2>
            <div className="flex flex-col gap-1">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={user.avatarUrl ?? undefined} />
                    <AvatarFallback>
                      {(user.nickname ?? user.email)?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {user.nickname || user.email}
                    </p>
                    {user.nickname && (
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      user.platformRole === "super_admin" ? "default" : "secondary"
                    }
                  >
                    {user.platformRole === "super_admin" ? "Super Admin" : "User"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={busy}
                    onClick={() => handleToggleRole(user.id, user.platformRole)}
                    title={
                      user.platformRole === "super_admin"
                        ? "取消超管"
                        : "设为超管"
                    }
                  >
                    {user.platformRole === "super_admin" ? (
                      <ShieldOffIcon className="size-4" />
                    ) : (
                      <ShieldIcon className="size-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
