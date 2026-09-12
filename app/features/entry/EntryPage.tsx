"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef } from "react";
import { CampusIcon, ThemeArtwork } from "@/app/components/campus/primitives";
import { useEntryController } from "./useEntryController";
import styles from "./EntryPage.module.css";

const productLines = [
  { icon: "attendance", title: "日常班务", detail: "名册、作业、考勤和沟通集中处理" },
  { icon: "dictation", title: "听写与复习", detail: "课堂批改与家庭错词各自独立" },
  { icon: "growth", title: "长期档案", detail: "从每天记录沉淀学生成长线索" },
];

export function EntryPage() {
  const entry = useEntryController();
  const contentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(entry.closeForm);

  useEffect(() => {
    closeRef.current = entry.closeForm;
  }, [entry.closeForm]);

  useEffect(() => {
    if (!entry.open) return;
    const previous = document.activeElement as HTMLElement | null;
    const opener = openerRef.current;
    const content = contentRef.current;
    const previousOverflow = document.body.style.overflow;
    if (content) content.inert = true;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => codeRef.current?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      if (content) content.inert = false;
      document.body.style.overflow = previousOverflow;
      (previous ?? opener)?.focus?.();
    };
  }, [entry.open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void entry.submitCredentials();
  }

  return (
    <main className={styles.page}>
      <div ref={contentRef} className={styles.pageContent}>
        <header className={styles.topbar}>
          <Link className={styles.brand} href="/" aria-label="班主任工作台首页">
            <span><CampusIcon name="book" /></span>
            <strong>班主任工作台</strong>
          </Link>
          <Link className={styles.privacyLink} href="/privacy"><CampusIcon name="lock" />隐私与数据说明</Link>
        </header>

        <section className={styles.hero} aria-labelledby="entry-title">
          <div className={styles.copy}>
            <p className={styles.kicker}>给班主任的一张工作桌</p>
            <h1 id="entry-title">把每天的班务，<br />理顺在一处</h1>
            <p className={styles.summary}>从今天要处理的学生和任务出发，持续积累班级记录；电脑端与手机端使用同一份业务数据。</p>
            <div className={styles.actions}>
              <button ref={openerRef} className={styles.primary} type="button" onClick={() => void entry.enterWorkspace()} disabled={entry.checking}>
                <CampusIcon name={entry.checking ? "sync" : "arrow"} />
                {entry.checking ? "正在检查…" : "进入我的工作台"}
              </button>
              <Link className={styles.demoLink} href="/w/demo"><CampusIcon name="view" />查看只读演示</Link>
            </div>
            <p className={styles.sessionNote}><CampusIcon name="lock" />正式数据按账户隔离；首次使用需兑换码与手机号。</p>
          </div>

          <figure className={styles.illustration}>
            <div className={styles.skyBlock} aria-hidden="true" />
            <ThemeArtwork slot="entry" className={styles.heroImage} />
            <figcaption><CampusIcon name="school" /><span><b>从今日事务开始</b>学生、任务与长期档案保持关联</span></figcaption>
          </figure>

          <div className={styles.productLines} aria-label="工作台主要用途">
            {productLines.map((item) => (
              <div key={item.title}>
                <span><CampusIcon name={item.icon} /></span>
                <p><b>{item.title}</b><small>{item.detail}</small></p>
              </div>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <span>演示工作台使用示例数据，所有编辑仅供体验。</span>
          <Link href="/privacy">查看数据范围与 AI 使用说明</Link>
        </footer>
      </div>

      {entry.open ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) entry.closeForm();
        }}>
          <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="enter-dialog-title">
            <header className={styles.dialogHeader}>
              <span className={styles.dialogMark}><CampusIcon name="school" /></span>
              <div><p>正式工作台</p><h2 id="enter-dialog-title">验证后进入</h2></div>
              <button className={styles.closeButton} type="button" aria-label="关闭" onClick={entry.closeForm} disabled={entry.submitting}>×</button>
            </header>
            <form className={styles.form} onSubmit={submit}>
              <div className={styles.field}>
                <label htmlFor="redeem-code">兑换码</label>
                <input ref={codeRef} id="redeem-code" value={entry.redeemCode} onChange={(event) => entry.setRedeemCode(event.target.value)} autoComplete="one-time-code" spellCheck={false} required aria-describedby="entry-credentials-help" />
              </div>
              <div className={styles.field}>
                <label htmlFor="phone">手机号</label>
                <input id="phone" value={entry.phone} onChange={(event) => entry.setPhone(event.target.value)} inputMode="numeric" autoComplete="tel" maxLength={13} required aria-describedby="entry-credentials-help" />
              </div>
              <p id="entry-credentials-help" className={styles.helper}>首次进入会绑定当前浏览器；之后点击首页主按钮即可检查并进入。</p>
              {entry.error ? <p className={styles.error} role="alert"><CampusIcon name="warning" />{entry.error}</p> : null}
              <button className={styles.submit} type="submit" disabled={entry.submitting}>
                <CampusIcon name={entry.submitting ? "sync" : "arrow"} />
                {entry.submitting ? "正在验证…" : "验证并进入"}
              </button>
              <p className={styles.formPrivacy}>继续即表示仅将所填信息用于账户验证与设备绑定。<Link href="/privacy" onClick={(event) => {
                if (!entry.closeForm()) event.preventDefault();
              }}>查看说明</Link></p>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
