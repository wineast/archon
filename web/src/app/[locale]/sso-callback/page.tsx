"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { Spinner } from "@/components/ui/spinner";

export default function SSOCallbackPage() {
  const locale = useLocale();
  return (
    <div className="flex min-h-svh items-center justify-center">
      <AuthenticateWithRedirectCallback
        signInUrl={`/${locale}/sign-in`}
        signUpUrl={`/${locale}/sign-up`}
      />
      <Spinner className="size-6" />
    </div>
  );
}
