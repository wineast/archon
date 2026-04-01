"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useSignUp } from "@clerk/nextjs";
import { EyeIcon, EyeOffIcon, TicketIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const INVITATION_CODE_KEY = "pendingInvitationCode";

/** TEMP: remove ASAP — emergency bypass via `?test=...` (does not consume an invite). */
const TEMP_INVITE_BYPASS_QUERY_KEY = "test";
const TEMP_INVITE_BYPASS_QUERY_VALUE = "dsafioudfsuaoiqnrjekkasfiuyqre";

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

interface SignUpFormData {
  email: string;
  password: string;
  code: string;
  invitationCode: string;
}

interface SignUpFormProps {
  redirectUrl: string;
}

export function SignUpForm({ redirectUrl }: SignUpFormProps) {
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const { signUp, setActive, isLoaded } = useSignUp();
  const locale = useLocale();
  const router = useRouter();
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    getValues,
    setValue,
  } = useForm<SignUpFormData>({
    defaultValues: { email: "", password: "", code: "", invitationCode: "" },
  });
  const [showPassword, setShowPassword] = useState(false);
  // DISABLED: 邀请码功能已禁用，直接进入注册表单
  const [step, setStep] = useState<"invitation" | "form" | "verify">(
    "form", // 原值: "invitation"
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // DISABLED: 邀请码绕过功能已不需要（默认直接进入表单）
  // useEffect(() => {
  //   const q = searchParams.get(TEMP_INVITE_BYPASS_QUERY_KEY);
  //   if (q === TEMP_INVITE_BYPASS_QUERY_VALUE) {
  //     setStep("form");
  //   }
  // }, [searchParams]);

  const handleVerifyInvitation = async (data: SignUpFormData) => {
    if (busyAction) return;

    const trimmed = data.invitationCode.trim();
    if (!trimmed) return;

    setBusyAction("invitation");
    try {
      const res = await fetch("/api/invitation-codes/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const result = await res.json();
      if (result.valid) {
        sessionStorage.setItem(INVITATION_CODE_KEY, trimmed.toUpperCase());
        setStep("form");
      } else {
        toast.error(result.error || t("invitation.invalidFallback"));
      }
    } catch {
      toast.error(t("invitation.verifyError"));
    } finally {
      setBusyAction(null);
    }
  };

  const onSubmit = async (data: SignUpFormData) => {
    if (!isLoaded || busyAction) return;

    setBusyAction("submit");
    try {
      const result = await signUp.create({
        emailAddress: data.email,
        password: data.password,
      });

      // DISABLED: 跳过邮箱验证，直接激活账号
      // await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      // setStep("verify");

      // 尝试直接激活 session（如果 Clerk 配置允许）
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // Consume invitation code after successful activation
        const pending = sessionStorage.getItem(INVITATION_CODE_KEY);
        if (pending) {
          await consumeInvitationCode(pending);
        }
        router.push(redirectUrl);
      } else {
        // 如果 Clerk 要求验证，回退到验证流程
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? t("signUp.error"));
    } finally {
      setBusyAction(null);
    }
  };

  const onVerify = async (data: SignUpFormData) => {
    if (!isLoaded || busyAction) return;

    setBusyAction("verify");
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: data.code,
      });

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
        redirectUrl: `/${locale}/sso-callback`,
        redirectUrlComplete: redirectUrl,
      });
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? t("signUp.googleError"));
      setBusyAction(null);
    }
  };

  // DISABLED: 邀请码验证页面已禁用
  // if (step === "invitation") {
  //   return (
  //     <Card className="w-full max-w-sm">
  //       <CardHeader className="text-center">
  //         <CardTitle className="text-xl">{t("invitation.title")}</CardTitle>
  //         <CardDescription>{t("invitation.description")}</CardDescription>
  //       </CardHeader>
  //       <CardContent>
  //         <form
  //           onSubmit={rhfHandleSubmit(handleVerifyInvitation)}
  //           className="grid gap-4"
  //         >
  //           <div className="grid gap-2">
  //             <Label htmlFor="invitation-code">{t("invitation.label")}</Label>
  //             <Input
  //               id="invitation-code"
  //               type="text"
  //               placeholder={t("invitation.placeholder")}
  //               autoComplete="off"
  //               required
  //               maxLength={8}
  //               {...register("invitationCode", {
  //                 onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
  //                   setValue("invitationCode", e.target.value.toUpperCase());
  //                 },
  //               })}
  //               className="text-center text-lg tracking-widest"
  //             />
  //           </div>
  //           <Button type="submit" className="w-full" disabled={!!busyAction}>
  //             {busyAction === "invitation" ? (
  //               <Spinner className="size-4" />
  //             ) : (
  //               <TicketIcon className="size-4" />
  //             )}
  //             {t("invitation.verifyButton")}
  //           </Button>
  //           <div className="text-center text-sm">
  //             {t("signUp.hasAccount")}{" "}
  //             <Link href="/sign-in" className="underline underline-offset-4">
  //               {t("signUp.link")}
  //             </Link>
  //           </div>
  //         </form>
  //       </CardContent>
  //     </Card>
  //   );
  // }

  if (step === "verify") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("verify.emailTitle")}</CardTitle>
          <CardDescription>
            {t("verify.description", { email: getValues("email") })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={rhfHandleSubmit(onVerify)} className="grid gap-4">
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
                {...register("code")}
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="size-4"
              >
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
            )}
            {t("signUp.google")}
          </Button>

          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-card px-2 text-muted-foreground">
              {tc("or")}
            </span>
          </div>

          <form onSubmit={rhfHandleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t("email.label")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("email.placeholder")}
                autoComplete="email"
                required
                {...register("email")}
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
                  {...register("password")}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
            </div>
            {/* Required when Clerk Bot sign-up protection (Smart CAPTCHA) is enabled — see Clerk custom flows */}
            <div id="clerk-captcha" className="flex min-h-px justify-center" />
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
