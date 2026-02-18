"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";

function SignUpContent() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") ?? "/";

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <SignUpForm redirectUrl={redirectUrl} />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  );
}
