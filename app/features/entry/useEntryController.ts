"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AuthResponse = { workspace?: { path?: string }; error?: string };

export function useEntryController() {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const dirty = useMemo(() => Boolean(redeemCode.trim() || phone.trim()), [phone, redeemCode]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("enter") === "1") setOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    if (submitting) return false;
    if (dirty && !window.confirm("兑换码或手机号尚未提交，确定关闭？")) return false;
    setOpen(false);
    return true;
  }, [dirty, submitting]);

  const enterWorkspace = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (response.ok) {
        const body = await response.json() as AuthResponse;
        if (body.workspace?.path) window.location.assign(body.workspace.path);
        return;
      }
      if (response.status !== 401) {
        const body = await response.json().catch(() => ({})) as AuthResponse;
        setError(body.error || "暂时无法检查工作台状态");
      }
      setOpen(true);
    } catch {
      setError("网络连接失败，请稍后重试");
      setOpen(true);
    } finally {
      setChecking(false);
    }
  }, []);

  const submitCredentials = useCallback(async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redeemCode, phone }),
      });
      const body = await response.json().catch(() => ({})) as AuthResponse;
      if (!response.ok) throw new Error(body.error || "暂时无法进入工作台");
      if (!body.workspace?.path) throw new Error("工作台地址创建失败");
      window.location.assign(body.workspace.path);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "暂时无法进入工作台");
    } finally {
      setSubmitting(false);
    }
  }, [phone, redeemCode]);

  return {
    open,
    checking,
    submitting,
    redeemCode,
    phone,
    error,
    dirty,
    setRedeemCode,
    setPhone,
    closeForm,
    enterWorkspace,
    submitCredentials,
  };
}
