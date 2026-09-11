"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type UserRow = { id: number; phone: string; status: "active" | "disabled"; class_name?: string; expires_at?: string; workspaceMode?: "active" | "readonly" | "expired"; active_devices: number };
type CodeRow = { id: number; code: string | null; code_hint: string; phone: string; status: "active" | "disabled" | "used"; max_devices: number; expires_at: number; workspace_expires_at?: number };
type DeviceRow = { id: number; device_name: string; status: "active" | "revoked"; last_seen_at: number };
type AuditRow = { id: number; action: string; target_type: string; target_id?: string; detail?: string; source_ip: string; created_at: number };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "操作失败");
  return body;
}

function formatDate(value?: number | string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("zh-CN");
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [codeQuery, setCodeQuery] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [codePage, setCodePage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [codeTotal, setCodeTotal] = useState(0);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [deviceUser, setDeviceUser] = useState<UserRow | null>(null);
  const [phoneUser, setPhoneUser] = useState<UserRow | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [codeLength, setCodeLength] = useState(8);
  const [maxDevices, setMaxDevices] = useState(2);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const deviceBackdropRef = useRef<HTMLDivElement>(null);
  const deviceDialogRef = useRef<HTMLElement>(null);
  const deviceOpenerRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    const [userData, codeData, auditData] = await Promise.all([
      api<{ users: UserRow[]; total: number }>(`/api/admin/users?q=${encodeURIComponent(userQuery)}&page=${userPage}`),
      api<{ codes: CodeRow[]; total: number }>(`/api/admin/redeem-codes?q=${encodeURIComponent(codeQuery)}&page=${codePage}`),
      api<{ logs: AuditRow[] }>("/api/admin/audit-logs"),
    ]);
    setUsers(userData.users);
    setCodes(codeData.codes);
    setUserTotal(userData.total);
    setCodeTotal(codeData.total);
    setAuditLogs(auditData.logs);
  }, [codePage, codeQuery, userPage, userQuery]);

  useEffect(() => {
    api<{ authenticated: boolean }>("/api/admin/session").then(async () => { setAuthenticated(true); await load(); }).catch(() => setAuthenticated(false));
  }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await api("/api/admin/session", { method: "POST", body: JSON.stringify({ password }) }); setAuthenticated(true); setPassword(""); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "登录失败"); }
    finally { setBusy(false); }
  }

  async function generateCode() {
    setBusy(true); setMessage("");
    try { const result = await api<{ codes: string[] }>("/api/admin/redeem-codes", { method: "POST", body: JSON.stringify({ maxDevices, validDays: 30, quantity, codeLength }) }); setNewCodes(result.codes); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "生成失败"); }
    finally { setBusy(false); }
  }

  async function mutate(url: string, init: RequestInit, success: string) {
    setBusy(true); setMessage("");
    try { await api(url, init); setMessage(success); await load(); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : "操作失败"); return false; }
    finally { setBusy(false); }
  }

  async function openDevices(user: UserRow) {
    deviceOpenerRef.current = document.activeElement as HTMLElement | null;
    setDeviceUser(user);
    try { const result = await api<{ devices: DeviceRow[] }>(`/api/admin/users/${user.id}/devices`); setDevices(result.devices); }
    catch (error) { setMessage(error instanceof Error ? error.message : "设备读取失败"); }
  }

  async function savePhone(event: FormEvent) {
    event.preventDefault();
    if (!phoneUser) return;
    setBusy(true); setMessage("");
    try {
      await api(`/api/admin/users/${phoneUser.id}`, { method: "PATCH", body: JSON.stringify({ phone: phoneDraft, status: phoneUser.status }) });
      setPhoneUser(null);
      setMessage("手机号已更新，用户下次可使用新手机号进入");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "手机号更新失败");
    } finally {
      setBusy(false);
    }
  }

  async function exportUserData(user: UserRow) {
    setBusy(true); setMessage("");
    try {
      const result = await api<Record<string, unknown>>(`/api/admin/users/${user.id}/data`);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `classroom-user-${user.phone}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("用户完整数据已导出");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "用户数据导出失败");
    } finally {
      setBusy(false);
    }
  }

  function deleteUserData(user: UserRow) {
    setDeleteTarget(user);
    setDeleteConfirmation("");
  }

  async function confirmDeleteUserData(event: FormEvent) {
    event.preventDefault();
    if (!deleteTarget) return;
    if (deleteConfirmation !== deleteTarget.phone) {
      setMessage("手机号不一致，未执行删除");
      return;
    }
    const deleted = await mutate(`/api/admin/users/${deleteTarget.id}/data`, { method: "DELETE", body: JSON.stringify({ confirmation: deleteConfirmation }) }, "用户账户和工作台数据已永久删除");
    if (deleted) {
      setDeleteTarget(null);
      setDeleteConfirmation("");
    }
  }

  useEffect(() => {
    if (!deviceUser || !deviceBackdropRef.current || !deviceDialogRef.current) return;
    const backdrop = deviceBackdropRef.current;
    const dialog = deviceDialogRef.current;
    const siblings = Array.from(backdrop.parentElement?.children ?? []).filter((item) => item !== backdrop) as HTMLElement[];
    siblings.forEach((item) => { item.inert = true; });
    const focusClose = window.setTimeout(() => dialog.querySelector<HTMLElement>('button[aria-label="关闭"]')?.focus(), 20);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setDeviceUser(null); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusClose);
      document.removeEventListener("keydown", onKeyDown);
      siblings.forEach((item) => { item.inert = false; });
      deviceOpenerRef.current?.focus();
    };
  }, [deviceUser]);

  if (authenticated === null) return <main className="admin-loading">正在检查管理权限…</main>;
  if (!authenticated) return <main className="admin-login-page"><form className="admin-login" onSubmit={login}><p>班主任工作台</p><h1>管理员登录</h1><label htmlFor="admin-password">管理员密码</label><input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />{message ? <p className="admin-alert" role="alert">{message}</p> : null}<button type="submit" disabled={busy}>{busy ? "正在验证…" : "进入后台"}</button><Link href="/">返回首页</Link></form></main>;

  return (
    <main className="admin-page">
      <header className="admin-header"><div><p>班主任工作台</p><h1>运营管理</h1></div><button type="button" onClick={async () => { await api("/api/admin/session", { method: "DELETE" }); location.reload(); }}>退出</button></header>
      {message ? <div className="admin-notice" role="status">{message}</div> : null}

      <section className="admin-section admin-code-maker" aria-labelledby="code-title"><div><h2 id="code-title">生成兑换码</h2><p>首次使用前 30 天有效，兑换后工作台可使用一年。</p></div><label>兑换码长度<select value={codeLength} onChange={(event) => setCodeLength(Number(event.target.value))}><option value={6}>6 位</option><option value={7}>7 位</option><option value={8}>8 位</option></select></label><label>生成数量<input type="number" min={1} max={50} value={quantity} onChange={(event) => setQuantity(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} /></label><label>设备上限<select value={maxDevices} onChange={(event) => setMaxDevices(Number(event.target.value))}><option value={1}>1 台</option><option value={2}>2 台</option><option value={3}>3 台</option></select></label><button type="button" onClick={generateCode} disabled={busy}>{busy ? "正在生成…" : `生成 ${quantity} 个`}</button></section>
      {newCodes.length ? <section className="admin-issued" aria-live="polite"><div className="admin-issued-head"><div><b>刚生成的兑换码</b><p>已加入下方记录，可随时查看和复制。</p></div><button type="button" onClick={() => navigator.clipboard.writeText(newCodes.join("\n"))}>复制全部</button></div><div className="admin-issued-codes">{newCodes.map((code) => <div key={code}><code>{code}</code><button type="button" onClick={() => navigator.clipboard.writeText(code)}>复制</button></div>)}</div></section> : null}

      <section className="admin-section"><div className="admin-section-head"><div><p className="admin-eyebrow">用户</p><h2>工作台账户</h2></div><span>{userTotal} 位</span></div><div className="admin-table-filter"><label htmlFor="user-search">搜索账户</label><input id="user-search" value={userQuery} onChange={(event) => { setUserQuery(event.target.value); setUserPage(1); }} placeholder="手机号或班级名称" /></div><div className="admin-table-wrap"><table><thead><tr><th>手机号</th><th>班级</th><th>状态</th><th>有效期</th><th>设备</th><th>操作</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id}><td>{user.phone}</td><td>{user.class_name || "未命名班级"}</td><td><span className={`admin-status ${user.status === "active" ? "is-active" : "is-disabled"}`}>{user.status === "active" ? (user.workspaceMode === "readonly" ? "只读宽限" : user.workspaceMode === "expired" ? "已到期" : "正常") : "已禁用"}</span></td><td>{formatDate(user.expires_at)}</td><td><button className="admin-text-button" type="button" onClick={() => openDevices(user)}>{user.active_devices} 台</button></td><td><div className="admin-row-actions"><button type="button" onClick={() => { setPhoneUser(user); setPhoneDraft(user.phone); }}>改手机号</button><button type="button" onClick={() => mutate(`/api/admin/users/${user.id}/renew`, { method: "POST" }, "已续期一年")}>续期</button><button type="button" onClick={() => void exportUserData(user)}>导出</button><button type="button" onClick={() => mutate(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ status: user.status === "active" ? "disabled" : "active" }) }, user.status === "active" ? "用户已禁用" : "用户已恢复")}>{user.status === "active" ? "禁用" : "恢复"}</button><button className="admin-danger-action" type="button" onClick={() => void deleteUserData(user)}>删除数据</button></div></td></tr>)}
        {!users.length ? <tr><td colSpan={6} className="admin-empty">尚无正式用户</td></tr> : null}
      </tbody></table></div>{userTotal > 25 ? <div className="admin-pagination"><button type="button" disabled={userPage <= 1} onClick={() => setUserPage((page) => page - 1)}>上一页</button><span>第 {userPage} / {Math.ceil(userTotal / 25)} 页</span><button type="button" disabled={userPage >= Math.ceil(userTotal / 25)} onClick={() => setUserPage((page) => page + 1)}>下一页</button></div> : null}</section>

      <section className="admin-section"><div className="admin-section-head"><div><h2>兑换码记录</h2></div><span>{codeTotal} 条</span></div><div className="admin-table-filter"><label htmlFor="code-search">搜索兑换码</label><input id="code-search" value={codeQuery} onChange={(event) => { setCodeQuery(event.target.value); setCodePage(1); }} placeholder="尾号、手机号或状态" /></div><div className="admin-table-wrap"><table><thead><tr><th>兑换码</th><th>绑定手机号</th><th>状态</th><th>设备上限</th><th>有效期</th><th>操作</th></tr></thead><tbody>
        {codes.map((code) => <tr key={code.id}><td><div className="admin-code-cell"><code>{code.code ?? `历史码（尾号 ${code.code_hint}）`}</code>{code.code ? <button type="button" onClick={() => navigator.clipboard.writeText(code.code ?? "")}>复制</button> : null}</div></td><td>{code.phone || "未绑定"}</td><td><span className={`admin-status ${code.status === "active" ? "is-active" : "is-disabled"}`}>{code.status === "active" ? "未使用" : code.status === "used" ? "已使用" : "已禁用"}</span></td><td>{code.max_devices} 台</td><td>{formatDate(code.workspace_expires_at ?? code.expires_at)}</td><td>{code.status === "used" ? <span className="admin-static-action">已兑换</span> : <button type="button" onClick={() => mutate(`/api/admin/redeem-codes/${code.id}`, { method: "PATCH", body: JSON.stringify({ status: code.status === "active" ? "disabled" : "active" }) }, "兑换码状态已更新")}>{code.status === "active" ? "禁用" : "启用"}</button>}</td></tr>)}
        {!codes.length ? <tr><td colSpan={6} className="admin-empty">尚未生成兑换码</td></tr> : null}
      </tbody></table></div>{codeTotal > 25 ? <div className="admin-pagination"><button type="button" disabled={codePage <= 1} onClick={() => setCodePage((page) => page - 1)}>上一页</button><span>第 {codePage} / {Math.ceil(codeTotal / 25)} 页</span><button type="button" disabled={codePage >= Math.ceil(codeTotal / 25)} onClick={() => setCodePage((page) => page + 1)}>下一页</button></div> : null}</section>

      <section className="admin-section"><div className="admin-section-head"><div><h2>管理操作记录</h2><p>保留最近 100 条高风险操作，便于排查账号和数据问题。</p></div><span>{auditLogs.length} 条</span></div><div className="admin-table-wrap"><table><thead><tr><th>时间</th><th>操作</th><th>对象</th><th>来源</th><th>说明</th></tr></thead><tbody>{auditLogs.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString("zh-CN")}</td><td>{log.action}</td><td>{log.target_type}{log.target_id ? ` #${log.target_id}` : ""}</td><td>{log.source_ip}</td><td>{log.detail || "—"}</td></tr>)}{!auditLogs.length ? <tr><td colSpan={5} className="admin-empty">暂无管理操作记录</td></tr> : null}</tbody></table></div></section>

      {deviceUser ? <div ref={deviceBackdropRef} className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeviceUser(null); }}><section ref={deviceDialogRef} className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="device-title"><header><div><p>{deviceUser.phone}</p><h2 id="device-title">已绑定浏览器</h2></div><button type="button" aria-label="关闭" onClick={() => setDeviceUser(null)}>×</button></header><div className="admin-device-list">{devices.map((device) => <div key={device.id}><div><b>{device.device_name}</b><p>最近使用 {formatDate(device.last_seen_at)}</p></div><span className={`admin-status ${device.status === "active" ? "is-active" : "is-disabled"}`}>{device.status === "active" ? "有效" : "已解绑"}</span>{device.status === "active" ? <button type="button" onClick={async () => { await mutate(`/api/admin/devices/${device.id}`, { method: "DELETE" }, "浏览器已解绑"); await openDevices(deviceUser); }}>解绑</button> : null}</div>)}{!devices.length ? <p className="admin-empty">没有设备记录</p> : null}</div></section></div> : null}
      {phoneUser ? <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhoneUser(null); }}><form className="admin-dialog admin-phone-dialog" role="dialog" aria-modal="true" aria-labelledby="phone-title" onSubmit={savePhone}><header><div><p>账户修正</p><h2 id="phone-title">修改登录手机号</h2></div><button type="button" aria-label="关闭" onClick={() => setPhoneUser(null)}>×</button></header><div className="admin-phone-form"><label htmlFor="correct-phone">新手机号</label><input id="correct-phone" autoFocus inputMode="numeric" maxLength={11} value={phoneDraft} onChange={(event) => setPhoneDraft(event.target.value.replace(/\D/g, ""))} /><p>修改后，原兑换码需要配合新手机号在其他浏览器进入。</p></div><footer><button type="button" onClick={() => setPhoneUser(null)}>取消</button><button type="submit" disabled={busy || !/^1[3-9]\d{9}$/.test(phoneDraft)}>确认修改</button></footer></form></div> : null}
      {deleteTarget ? <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) { setDeleteTarget(null); setDeleteConfirmation(""); } }}><form className="admin-dialog admin-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-data-title" onSubmit={confirmDeleteUserData}><header><div><p>不可逆操作</p><h2 id="delete-data-title">永久删除账户数据</h2></div><button type="button" aria-label="关闭" onClick={() => { if (!busy) { setDeleteTarget(null); setDeleteConfirmation(""); } }}>×</button></header><div className="admin-delete-form"><p>将删除 <strong>{deleteTarget.phone}</strong> 的账户、工作台、设备和全部班级数据。建议先使用“导出”保存备份。</p><label htmlFor="delete-phone-confirm">输入完整手机号确认</label><input id="delete-phone-confirm" autoFocus inputMode="numeric" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.replace(/\D/g, ""))} placeholder={deleteTarget.phone} /><small>输入不一致时不会执行删除。</small></div><footer><button type="button" onClick={() => { if (!busy) { setDeleteTarget(null); setDeleteConfirmation(""); } }}>取消</button><button type="submit" className="admin-danger-action" disabled={busy || deleteConfirmation !== deleteTarget.phone}>{busy ? "正在删除…" : "确认永久删除"}</button></footer></form></div> : null}
    </main>
  );
}
