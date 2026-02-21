"use client";

import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useCallback, useRef } from "react";

/**
 * 管理 URL 中的 `?session=<id>` 参数。
 * 使用 isInternalNavRef 区分组件主动改 URL 和浏览器 popstate，避免循环。
 */
export function useSessionParam() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isInternalNavRef = useRef(false);

  const sessionId = searchParams.get("session");

  const setSessionParam = useCallback(
    (id: string | null, opts?: { replace?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set("session", id);
      } else {
        params.delete("session");
      }
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;

      isInternalNavRef.current = true;
      if (opts?.replace) {
        router.replace(url);
      } else {
        router.push(url);
      }
    },
    [searchParams, router, pathname]
  );

  return { sessionId, setSessionParam, isInternalNavRef };
}
