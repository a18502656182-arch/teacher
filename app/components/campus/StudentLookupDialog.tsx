"use client";
import { useEffect, useId, useMemo, useState } from "react";
import type { Student } from "@/lib/classroom";

export function StudentLookupDialog({ title, subtitle, students, selectedId, allowClear, clearLabel = "清空选择", onPick, onClear, onClose }: { title: string; subtitle?: string; students: Student[]; selectedId?: string; allowClear?: boolean; clearLabel?: string; onPick: (student: Student) => void; onClear?: () => void; onClose: () => void }) {
  const titleId = useId();
  const [keyword, setKeyword] = useState("");
  const [range, setRange] = useState("前12名");
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => [...students].sort((a, b) => Number(a.studentNo || a.seat || 0) - Number(b.studentNo || b.seat || 0) || a.name.localeCompare(b.name, "zh-CN")), [students]);
  const ranges = useMemo(() => {
    const count = Math.ceil(sorted.length / 20);
    return Array.from({ length: count }, (_, index) => ({ key: `${index * 20}-${index * 20 + 19}`, label: `${String(index * 20 + 1).padStart(2, "0")}-${String(Math.min(sorted.length, index * 20 + 20)).padStart(2, "0")}` }));
  }, [sorted.length]);
  const query = keyword.trim().toLocaleLowerCase("zh-CN");
  const ranged = range === "前12名" ? sorted.slice(0, 12) : sorted.slice(Number(range.split("-")[0]), Number(range.split("-")[1]) + 1);
  const matches = query ? sorted.filter((student) => `${student.name}${student.studentNo ?? ""}${student.group}${student.seat}${student.parentPhone ?? ""}`.toLocaleLowerCase("zh-CN").includes(query)) : ranged;
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = matches.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => setPage(1), [keyword, range]);

  return <div className="student-lookup-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="student-lookup-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button aria-label="关闭学生选择" onClick={onClose}>关闭</button>
      </header>
      <div className="student-lookup-tools">
        <input aria-label="搜索学生" autoFocus value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索姓名、学号、座位或小组" />
        <nav aria-label="学生范围">
          <button className={range === "前12名" && !query ? "active" : ""} onClick={() => { setRange("前12名"); setKeyword(""); }}>前12名</button>
          {ranges.map((item) => <button className={range === item.key && !query ? "active" : ""} key={item.key} onClick={() => { setRange(item.key); setKeyword(""); }}>{item.label}</button>)}
        </nav>
      </div>
      <div className="student-lookup-list">
        {paged.length ? paged.map((student) => <button className={selectedId === student.id ? "active" : ""} key={student.id} onClick={() => onPick(student)}>
          <i>{student.name.slice(0, 1)}</i>
          <span><b>{student.name}</b><small>学号 {student.studentNo || "未填"} · 第{student.group}组 · 座{student.seat}</small></span>
          <em>{selectedId === student.id ? "当前" : "选择"}</em>
        </button>) : <p>没有找到符合条件的学生。</p>}
      </div>
      <footer>
        <span>{query ? `搜索到 ${matches.length} 人` : range === "前12名" ? "按学号显示前12名，搜索可查全班" : `当前范围 ${matches.length} 人`}</span>
        <div>
          {allowClear && <button onClick={() => { onClear?.(); onClose(); }}>{clearLabel}</button>}
          {matches.length > pageSize && <><button disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button><button disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>下一页</button></>}
        </div>
      </footer>
    </section>
  </div>;
}
