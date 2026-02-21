"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useSignUp } from "@clerk/nextjs";
import { EyeIcon, EyeOffIcon, TicketIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const INVITATION_CODE_KEY = "pendingInvitationCode";

async function consumeInvitationCode(code: string) {
  try {
    await fetch("/api/invitation-codes/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  } catch {
    // Best-effort — don't block signup flow
  } finally {
    sessionStorage.removeItem(INVITATION_CODE_KEY);
  }
}

interface SignUpFormProps {
  redirectUrl: string;
}

export function SignUpForm({ redirectUrl }: SignUpFormProps) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"invitation" | "form" | "verify">("invitation");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const handleVerifyInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyAction) return;

    const trimmed = invitationCode.trim();
    if (!trimmed) return;

    setBusyAction("invitation");
    try {
      const res = await fetch("/api/invitation-codes/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (data.valid) {
        sessionStorage.setItem(INVITATION_CODE_KEY, trimmed.toUpperCase());
        setStep("form");
      } else {
        toast.error(data.error || "邀请码无效");
      }
    } catch {
      toast.error("验证邀请码失败");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || busyAction) return;

    setBusyAction("submit");
    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? t("signUp.error"));
    } finally {
      setBusyAction(null);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || busyAction) return;

    setBusyAction("verify");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // Consume invitation code after successful activation
        const pending = sessionStorage.getItem(INVITATION_CODE_KEY);
        if (pending) {
          await consumeInvitationCode(pending);
        }
        router.push(redirectUrl);
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? t("verify.error"));
    } finally {
      setBusyAction(null);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || busyAction) return;

    setBusyAction("resend");
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      toast.success(t("resend.success"));
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? t("resend.error"));
    } finally {
      setBusyAction(null);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!isLoaded || busyAction) return;

    setBusyAction("google");
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: redirectUrl,
      });
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? t("signUp.googleError"));
      setBusyAction(null);
    }
  };

  if (step === "invitation") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">输入邀请码</CardTitle>
          <CardDescription>请输入邀请码以继续注册</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerifyInvitation} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invitation-code">邀请码</Label>
              <Input
                id="invitation-code"
                type="text"
                placeholder="请输入 8 位邀请码"
                autoComplete="off"
                required
                maxLength={8}
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-widest"
              />
            </div>
            <Button type="submit" className="w-full" disabled={!!busyAction}>
              {busyAction === "invitation" ? (
                <Spinner className="size-4" />
              ) : (
                <TicketIcon className="size-4" />
              )}
              验证邀请码
            </Button>
            <div className="text-center text-sm">
              已有账号？{" "}
              <Link href="/sign-in" className="underline underline-offset-4">
                登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === "verify") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("verify.emailTitle")}</CardTitle>
          <CardDescription>{t("verify.description", { email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="code">{t("code.label")}</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder={t("code.placeholder")}
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!!busyAction}>
              {busyAction === "verify" && <Spinner className="size-4" />}
              {t("verify.button")}
            </Button>
            <div className="text-center text-sm">
              {t("resend.question")}{" "}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={handleResendCode}
                disabled={!!busyAction}
              >
                {t("resend.button")}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{t("signUp.title")}</CardTitle>
        <CardDescription>{t("signUp.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignUp}
            disabled={!!busyAction}
          >
            {busyAction === "google" ? (
              <Spinner className="size-4" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
            )}
            {t("signUp.google")}
          </Button>

          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-card px-2 text-muted-foreground">{tc("or")}</span>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t("email.label")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("email.placeholder")}
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t("password.label")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={!!busyAction}>
              {busyAction === "submit" && <Spinner className="size-4" />}
              {t("signUp.submit")}
            </Button>
          </form>

          <div className="text-center text-sm">
            {t("signUp.hasAccount")}{" "}
            <Link href="/sign-in" className="underline underline-offset-4">
              {t("signUp.link")}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
