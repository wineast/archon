"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useSignIn } from "@clerk/nextjs";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

interface SignInFormData {
  email: string;
  password: string;
  code: string;
}

interface SignInFormProps {
  redirectUrl: string;
}

export function SignInForm({ redirectUrl }: SignInFormProps) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const { signIn, setActive, isLoaded } = useSignIn();
  const locale = useLocale();
  const router = useRouter();
  const { register, handleSubmit: rhfHandleSubmit, getValues } = useForm<SignInFormData>({
    defaultValues: { email: "", password: "", code: "" },
  });
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const completeSignIn = async (sessionId: string | null) => {
    await setActive?.({ session: sessionId });
    router.push(redirectUrl);
  };

  const onSubmit = async (data: SignInFormData) => {
    if (!isLoaded || busyAction) return;

    setBusyAction("submit");
    try {
      const result = await signIn.create({
        identifier: data.email,
        password: data.password,
      });

      if (result.status === "complete") {
        await completeSignIn(result.createdSessionId);
      } else if (result.status === "needs_first_factor") {
        const factorResult = await signIn.attemptFirstFactor({
          strategy: "password",
          password: data.password,
        });
        if (factorResult.status === "complete") {
          await completeSignIn(factorResult.createdSessionId);
        } else if (factorResult.status === "needs_second_factor") {
          await signIn.prepareSecondFactor({ strategy: "email_code" });
          setStep("verify");
        }
      } else if (result.status === "needs_second_factor") {
        await signIn.prepareSecondFactor({ strategy: "email_code" });
        setStep("verify");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? t("signIn.error"));
    } finally {
      setBusyAction(null);
    }
  };

  const onVerify = async (data: SignInFormData) => {
    if (!isLoaded || busyAction) return;

    setBusyAction("verify");
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: data.code,
      });
      if (result.status === "complete") {
        await completeSignIn(result.createdSessionId);
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
      await signIn.prepareSecondFactor({ strategy: "email_code" });
      toast.success(t("resend.success"));
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? t("resend.error"));
    } finally {
      setBusyAction(null);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isLoaded || busyAction) return;

    setBusyAction("google");
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `/${locale}/sso-callback`,
        redirectUrlComplete: redirectUrl,
      });
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? t("googleError"));
      setBusyAction(null);
    }
  };

  if (step === "verify") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("verify.title")}</CardTitle>
          <CardDescription>{t("verify.description", { email: getValues("email") })}</CardDescription>
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
        <CardTitle className="text-xl">{t("signIn.title")}</CardTitle>
        <CardDescription>{t("signIn.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
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
            {t("signIn.google")}
          </Button>

          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-card px-2 text-muted-foreground">{tc("or")}</span>
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
                  autoComplete="current-password"
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
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={!!busyAction}>
              {busyAction === "submit" && <Spinner className="size-4" />}
              {t("signIn.submit")}
            </Button>
          </form>

          <div className="text-center text-sm">
            {t("signIn.noAccount")}{" "}
            <Link href="/sign-up" className="underline underline-offset-4">
              {t("signIn.link")}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
