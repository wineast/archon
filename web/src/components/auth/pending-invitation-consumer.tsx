"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

const INVITATION_CODE_KEY = "pendingInvitationCode";

export function PendingInvitationConsumer() {
  const { isSignedIn } = useAuth();
  const consumed = useRef(false);

  useEffect(() => {
    if (!isSignedIn || consumed.current) return;
    const code = sessionStorage.getItem(INVITATION_CODE_KEY);
    if (!code) return;

    consumed.current = true;
    fetch("/api/invitation-codes/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .catch(() => {})
      .finally(() => {
        sessionStorage.removeItem(INVITATION_CODE_KEY);
      });
  }, [isSignedIn]);

  return null;
}
