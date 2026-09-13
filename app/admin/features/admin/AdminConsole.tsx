'use client';

import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { CampusIcon, ThemeArtwork } from '@/app/components/campus/primitives';
import { ThemeBoundary } from '@/app/components/workbench/theme/ThemeBoundary';
import { Button } from '@/app/components/workbench/ui/Button';
import { Field, Input, Select } from '@/app/components/workbench/ui/Field';
import type { AdminView, CodeRow, UserRow } from './types';
import { AdminUserDialog, formatAdminDate } from './AdminUserDialog';
import { useAdminConsole } from './useAdminConsole';
import styles from './AdminConsole.module.css';

const sections: Array<{ id: AdminView; label: string; icon: string }> = [
  { id: 'users', label: '工作台账户', icon: 'students' },
  { id: 'codes', label: '兑换码', icon: 'lock' },
  { id: 'audit', label: '操作记录', icon: 'records' },
];

function userStatus(user: UserRow) {
  if (user.status === 'disabled') return { label: '已禁用', tone: 'disabled' };
  if (user.workspaceMode === 'readonly') return { label: '只读宽限', tone: 'readonly' };
  if (user.workspaceMode === 'expired') return { label: '已到期', tone: 'expired' };
  return { label: '正常', tone: 'active' };
}

function codeStatus(code: CodeRow) {
  if (code.status === 'used') return { label: '已使用', tone: 'used' };
  if (code.status === 'disabled') return { label: '已禁用', tone: 'disabled' };
  return { label: '未使用', tone: 'active' };
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 25));
  if (total <= 25) return null;
  return <nav className={styles.pager} aria-label="分页">
    <Button intent="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</Button>
    <span>第 {page} / {pages} 页</span>
    <Button intent="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>下一页</Button>
  </nav>;
}

function AdminTable({ children, label }: { children: ReactNode; label: string }) {
  return <div className={styles.tableWrap} role="region" aria-label={label} tabIndex={0}>{children}</div>;
}

export function AdminConsole() {
  const admin = useAdminConsole();

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void admin.login();
  }

  if (admin.authenticated === null) return <ThemeBoundary><main className={styles.loadingPage} role="status"><span><CampusIcon name="sync" /></span><h1>正在检查管理权限</h1><p>只会读取管理员会话，不会改动工作台数据。</p></main></ThemeBoundary>;

  if (!admin.authenticated) return <ThemeBoundary><main className={styles.loginPage}>
    <header className={styles.publicHeader}>
      <Link href="/" aria-label="班主任工作台首页"><span><CampusIcon name="book" /></span><b>班主任工作台</b></Link>
      <Link href="/"><CampusIcon name="arrow" />返回首页</Link>
    </header>
    <div className={styles.loginLayout}>
      <section className={styles.loginContext} aria-labelledby="admin-login-context">
        <p>独立权限区域</p>
        <h1 id="admin-login-context">运营数据只在管理员会话中显示</h1>
        <span>账户、设备、兑换码和永久删除均由服务端再次校验。普通工作台会话不能进入这里。</span>
        <ThemeArtwork slot="admin" className={styles.loginArt} />
      </section>
      <form className={styles.loginForm} onSubmit={submitLogin}>
        <p>管理入口</p>
        <h2>管理员登录</h2>
        <Field id="admin-password" label="管理员密码" required>
          <Input id="admin-password" autoFocus type="password" autoComplete="current-password" value={admin.password} onChange={(event) => admin.setPassword(event.target.value)} />
        </Field>
        {admin.notice && <p className={styles.formNotice} data-tone={admin.notice.tone} role={admin.notice.tone === 'error' ? 'alert' : 'status'}><CampusIcon name={admin.notice.tone === 'error' ? 'warning' : 'check'} />{admin.notice.text}</p>}
        <Button type="submit" intent="primary" busy={admin.busyAction === 'login'} disabled={!admin.password}>进入管理后台</Button>
        <small>连续失败会触发服务端限流；页面不会保存管理员密码。</small>
      </form>
    </div>
  </main></ThemeBoundary>;

  return <ThemeBoundary><main className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/"><span><CampusIcon name="book" /></span><b>班主任工作台</b></Link>
      <div><span>管理员会话</span><Button intent="text" busy={admin.busyAction === 'logout'} onClick={() => void admin.logout()}><CampusIcon name="user" />退出后台</Button></div>
    </header>

    <section className={styles.hero} aria-labelledby="admin-title">
      <div className={styles.heroCopy}><p>运营工作台</p><h1 id="admin-title">账户与访问管理</h1><span>先定位账户或兑换码，再进入详情执行受控操作。全部变更由服务端鉴权并写入操作记录。</span></div>
      <dl className={styles.metrics} aria-label="管理数据概况">
        <div><dt>正式账户</dt><dd>{admin.userSummaryTotal}</dd></div>
        <div><dt>兑换码</dt><dd>{admin.codeSummaryTotal}</dd></div>
        <div><dt>近期记录</dt><dd>{admin.auditLogs.length}</dd></div>
      </dl>
      <ThemeArtwork slot="admin" className={styles.heroArt} />
    </section>

    <nav className={styles.sectionNav} aria-label="管理员功能">
      {sections.map((section) => <button key={section.id} type="button" aria-current={admin.view === section.id ? 'page' : undefined} onClick={() => admin.setView(section.id)}><CampusIcon name={section.icon} />{section.label}</button>)}
    </nav>

    {admin.notice && <div className={styles.notice} data-tone={admin.notice.tone} role={admin.notice.tone === 'error' ? 'alert' : 'status'}><CampusIcon name={admin.notice.tone === 'error' ? 'warning' : 'check'} /><span>{admin.notice.text}</span><button type="button" onClick={() => admin.setNotice(null)} aria-label="关闭提示">×</button></div>}
    {admin.loadError && <div className={styles.notice} data-tone="error" role="alert"><CampusIcon name="warning" /><span>{admin.loadError}</span><Button intent="secondary" onClick={admin.reload}>重新读取</Button></div>}

    {admin.view === 'users' && <section className={styles.workspace} aria-labelledby="admin-users-title">
      <header className={styles.workspaceHeader}><div><p>用户</p><h2 id="admin-users-title">工作台账户</h2><span>手机号、工作台期限和设备数量来自服务端。</span></div><b>{admin.userTotal} 位</b></header>
      <div className={styles.toolbar}><Field id="admin-user-search" label="搜索账户"><Input id="admin-user-search" type="search" value={admin.userQuery} onChange={(event) => admin.setUserQuery(event.target.value)} placeholder="手机号或班级名称" /></Field><p><CampusIcon name="search" />点击手机号查看账户详情和受控操作</p></div>
      {admin.loading ? <p className={styles.loadingLine} role="status"><CampusIcon name="sync" />正在读取账户…</p> : <AdminTable label="工作台账户列表"><table className={styles.table}><thead><tr><th>手机号</th><th>班级</th><th>状态</th><th>有效期</th><th>设备</th><th><span className="visually-hidden">详情</span></th></tr></thead><tbody>
        {admin.users.map((user) => { const status = userStatus(user); return <tr key={user.id}>
          <td data-label="手机号"><button className={styles.primaryCell} type="button" onClick={() => admin.openUser(user)}>{user.phone}</button></td>
          <td data-label="班级">{user.class_name || '未命名班级'}</td>
          <td data-label="状态"><span className={styles.status} data-tone={status.tone}>{status.label}</span></td>
          <td data-label="有效期">{formatAdminDate(user.expires_at)}</td>
          <td data-label="设备">{user.active_devices} 台</td>
          <td data-label="详情"><Button intent="text" onClick={() => admin.openUser(user)}>查看<CampusIcon name="chevron" /></Button></td>
        </tr>; })}
        {!admin.users.length && <tr><td colSpan={6}><p className={styles.emptyLine}>没有符合条件的正式用户</p></td></tr>}
      </tbody></table></AdminTable>}
      <Pager page={admin.userPage} total={admin.userTotal} onPage={admin.setUserPage} />
    </section>}

    {admin.view === 'codes' && <section className={styles.workspace} aria-labelledby="admin-codes-title">
      <header className={styles.workspaceHeader}><div><p>兑换码</p><h2 id="admin-codes-title">生成与查询</h2><span>新码首次使用前30天有效，兑换后工作台按现有规则获得一年期限。</span></div><b>{admin.codeTotal} 条</b></header>
      <div className={styles.codeMaker}>
        <Field id="admin-code-length" label="兑换码长度"><Select id="admin-code-length" value={admin.codeLength} onChange={(event) => admin.setCodeLength(Number(event.target.value))}><option value={6}>6 位</option><option value={7}>7 位</option><option value={8}>8 位</option></Select></Field>
        <Field id="admin-code-quantity" label="生成数量"><Input id="admin-code-quantity" type="number" min={1} max={50} value={admin.quantity} onChange={(event) => admin.setQuantity(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} /></Field>
        <Field id="admin-code-devices" label="设备上限"><Select id="admin-code-devices" value={admin.maxDevices} onChange={(event) => admin.setMaxDevices(Number(event.target.value))}><option value={1}>1 台</option><option value={2}>2 台</option><option value={3}>3 台</option></Select></Field>
        <Button intent="primary" busy={admin.busyAction === 'generate-codes'} onClick={() => void admin.generateCodes()}><CampusIcon name="plus" />生成 {admin.quantity} 个</Button>
      </div>
      {admin.newCodes.length > 0 && <section className={styles.issued} aria-live="polite"><header><div><p>本次生成</p><h3>新兑换码</h3><span>已加入记录；请按实际需要复制并妥善传递。</span></div><Button intent="secondary" onClick={() => void admin.copyCodes(admin.newCodes, '全部新兑换码已复制')}><CampusIcon name="copy" />复制全部</Button></header><div>{admin.newCodes.map((code) => <p key={code}><code>{code}</code><Button intent="text" onClick={() => void admin.copyCodes([code], '兑换码已复制')}>复制</Button></p>)}</div></section>}
      <div className={styles.toolbar}><Field id="admin-code-search" label="搜索兑换码"><Input id="admin-code-search" type="search" value={admin.codeQuery} onChange={(event) => admin.setCodeQuery(event.target.value)} placeholder="尾号、手机号或状态" /></Field></div>
      {admin.loading ? <p className={styles.loadingLine} role="status"><CampusIcon name="sync" />正在读取兑换码…</p> : <AdminTable label="兑换码记录"><table className={styles.table}><thead><tr><th>兑换码</th><th>绑定手机号</th><th>状态</th><th>设备上限</th><th>有效期</th><th>操作</th></tr></thead><tbody>
        {admin.codes.map((code) => { const status = codeStatus(code); const display = code.code ?? `历史码（尾号 ${code.code_hint}）`; return <tr key={code.id}>
          <td data-label="兑换码"><span className={styles.codeCell}><code>{display}</code>{code.code && <Button intent="text" onClick={() => void admin.copyCodes([code.code!], '兑换码已复制')}>复制</Button>}</span></td>
          <td data-label="绑定手机号">{code.phone || '未绑定'}</td>
          <td data-label="状态"><span className={styles.status} data-tone={status.tone}>{status.label}</span></td>
          <td data-label="设备上限">{code.max_devices} 台</td>
          <td data-label="有效期">{formatAdminDate(code.workspace_expires_at ?? code.expires_at)}</td>
          <td data-label="操作">{code.status === 'used' ? <span className={styles.staticAction}>已兑换</span> : <Button intent="secondary" busy={admin.busyAction === `code-${code.id}`} onClick={() => void admin.toggleCode(code)}>{code.status === 'active' ? '禁用' : '启用'}</Button>}</td>
        </tr>; })}
        {!admin.codes.length && <tr><td colSpan={6}><p className={styles.emptyLine}>{admin.codeQuery ? '没有符合条件的兑换码' : '尚未生成兑换码'}</p></td></tr>}
      </tbody></table></AdminTable>}
      <Pager page={admin.codePage} total={admin.codeTotal} onPage={admin.setCodePage} />
    </section>}

    {admin.view === 'audit' && <section className={styles.workspace} aria-labelledby="admin-audit-title">
      <header className={styles.workspaceHeader}><div><p>追溯</p><h2 id="admin-audit-title">管理操作记录</h2><span>服务端保留最近100条管理操作，用于排查账户与数据问题。</span></div><b>{admin.auditLogs.length} 条</b></header>
      {admin.loading ? <p className={styles.loadingLine} role="status"><CampusIcon name="sync" />正在读取操作记录…</p> : <AdminTable label="管理操作记录"><table className={styles.table}><thead><tr><th>时间</th><th>操作</th><th>对象</th><th>来源</th><th>说明</th></tr></thead><tbody>
        {admin.auditLogs.map((log) => <tr key={log.id}><td data-label="时间">{formatAdminDate(log.created_at, true)}</td><td data-label="操作">{log.action}</td><td data-label="对象">{log.target_type}{log.target_id ? ` #${log.target_id}` : ''}</td><td data-label="来源">{log.source_ip}</td><td data-label="说明">{log.detail || '—'}</td></tr>)}
        {!admin.auditLogs.length && <tr><td colSpan={5}><p className={styles.emptyLine}>暂无管理操作记录</p></td></tr>}
      </tbody></table></AdminTable>}
    </section>}

    <footer className={styles.pageFooter}><p><CampusIcon name="lock" />管理员权限、网络白名单和操作审计均由服务端执行。</p><Link href="/privacy">隐私与数据说明</Link></footer>
    <AdminUserDialog admin={admin} />
  </main></ThemeBoundary>;
}
