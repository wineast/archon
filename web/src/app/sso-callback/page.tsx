"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <AuthenticateWithRedirectCallback />
      <Spinner className="size-6" />
    </div>
  );
}
