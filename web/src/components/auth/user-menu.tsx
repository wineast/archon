"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useUser, useClerk } from "@clerk/nextjs";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserSettingsModal } from "@/components/user/user-settings-modal";
import { useCurrentUser } from "@/lib/auth/hooks";

export function UserMenu() {
  const t = useTranslations("user");
  const { user } = useUser();
  const { signOut } = useClerk();
  const { user: currentUser } = useCurrentUser();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const imageUrl = user?.imageUrl;
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const nickname = currentUser?.nickname || user?.firstName || email.split("@")[0];
  const initials = (nickname?.[0] ?? email[0] ?? "U").toUpperCase();

  return (
    <>
      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-8 cursor-pointer">
              <AvatarImage src={imageUrl} alt={nickname} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="size-9">
              <AvatarImage src={imageUrl} alt={nickname} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{nickname}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="size-4" />
            {t("settings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/sign-in" })}>
            <LogOutIcon className="size-4" />
            {t("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
