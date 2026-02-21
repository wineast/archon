"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";

function SignInContent() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") ?? "/";

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <SignInForm redirectUrl={redirectUrl} />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
