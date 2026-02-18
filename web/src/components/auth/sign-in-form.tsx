"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

interface SignInFormProps {
  redirectUrl: string;
}

export function SignInForm({ redirectUrl }: SignInFormProps) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [busy, setBusy] = useState(false);

  const completeSignIn = async (sessionId: string | null) => {
    await setActive({ session: sessionId });
    router.push(redirectUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || busy) return;

    setBusy(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await completeSignIn(result.createdSessionId);
      } else if (result.status === "needs_first_factor") {
        const factorResult = await signIn.attemptFirstFactor({
          strategy: "password",
          password,
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
      toast.error(clerkErr.errors?.[0]?.longMessage ?? "登录失败");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || busy) return;

    setBusy(true);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code,
      });
      if (result.status === "complete") {
        await completeSignIn(result.createdSessionId);
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? "验证失败");
    } finally {
      setBusy(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || busy) return;

    setBusy(true);
    try {
      await signIn.prepareSecondFactor({ strategy: "email_code" });
      toast.success("验证码已重新发送");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? "发送失败");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isLoaded || busy) return;

    setBusy(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: redirectUrl,
      });
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string }[] };
      toast.error(clerkErr.errors?.[0]?.longMessage ?? "Google 登录失败");
      setBusy(false);
    }
  };

  if (step === "verify") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">验证身份</CardTitle>
          <CardDescription>我们已向 {email} 发送了验证码</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="code">验证码</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="请输入 6 位验证码"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Spinner className="size-4" />}
              验证
            </Button>
            <div className="text-center text-sm">
              没收到验证码？{" "}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={handleResendCode}
                disabled={busy}
              >
                重新发送
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
        <CardTitle className="text-xl">欢迎回来</CardTitle>
        <CardDescription>登录你的账号</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={busy}
          >
            {busy ? (
              <Spinner className="size-4" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
            )}
            使用 Google 登录
          </Button>

          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-card px-2 text-muted-foreground">或</span>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Spinner className="size-4" />}
              登录
            </Button>
          </form>

          <div className="text-center text-sm">
            还没有账号？{" "}
            <Link href="/sign-up" className="underline underline-offset-4">
              注册
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
