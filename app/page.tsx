"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type AuthResponse = { workspace?: { path?: string }; error?: string };

export default function Home() {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("enter") === "1") setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const shell = shellRef.current;
    const opener = openerRef.current;
    if (shell) shell.inert = true;
    const timer = window.setTimeout(() => codeRef.current?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setOpen(false);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      if (shell) shell.inert = false;
      (previous ?? opener)?.focus?.();
    };
  }, [open, submitting]);

  async function enterWorkspace() {
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
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
  }

  return (
    <main className="entry-page">
      <section ref={shellRef} className="entry-shell" aria-labelledby="entry-title">
        <div className="entry-brand" aria-hidden="true">班</div>
        <p className="entry-kicker">日常班务 · 长期档案</p>
        <h1 id="entry-title">班主任工作台</h1>
        <p className="entry-summary">把每天需要处理的学生、作业、沟通与班务放在一处。</p>
        <div className="entry-actions">
          <button ref={openerRef} className="entry-primary" type="button" onClick={enterWorkspace} disabled={checking}>
            {checking ? "正在检查…" : "进入我的工作台"}
          </button>
          <Link className="entry-secondary" href="/w/demo">查看演示</Link>
        </div>
        <p className="entry-footnote">正式工作台数据仅限绑定用户访问 · <Link href="/privacy">隐私与数据说明</Link></p>
      </section>

      {open ? (
        <div className="entry-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) setOpen(false);
        }}>
          <section ref={dialogRef} className="entry-dialog" role="dialog" aria-modal="true" aria-labelledby="enter-dialog-title">
            <header>
              <div><p>我的工作台</p><h2 id="enter-dialog-title">进入班主任工作台</h2></div>
              <button className="entry-dialog-close" type="button" aria-label="关闭" onClick={() => setOpen(false)} disabled={submitting}>×</button>
            </header>
            <form onSubmit={submit}>
              <label htmlFor="redeem-code">兑换码</label>
              <input ref={codeRef} id="redeem-code" value={redeemCode} onChange={(event) => setRedeemCode(event.target.value)} autoComplete="one-time-code" required />
              <label htmlFor="phone">手机号</label>
              <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="numeric" autoComplete="tel" maxLength={13} required />
              <p className="entry-helper">首次进入会绑定当前浏览器，之后本浏览器可直接打开。</p>
              {error ? <p className="entry-error" role="alert">{error}</p> : null}
              <button className="entry-primary" type="submit" disabled={submitting}>{submitting ? "正在进入…" : "进入"}</button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
