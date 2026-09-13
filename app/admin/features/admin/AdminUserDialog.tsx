'use client';

import type { FormEvent, ReactNode } from 'react';
import { CampusIcon } from '@/app/components/campus/primitives';
import { Button } from '@/app/components/workbench/ui/Button';
import { Dialog } from '@/app/components/workbench/ui/Dialog';
import { Field, Input } from '@/app/components/workbench/ui/Field';
import type { useAdminConsole } from './useAdminConsole';
import styles from './AdminConsole.module.css';

type Controller = ReturnType<typeof useAdminConsole>;

export function formatAdminDate(value?: number | string, includeTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return includeTime ? date.toLocaleString('zh-CN') : date.toLocaleDateString('zh-CN');
}

function userStatus(user: NonNullable<Controller['selectedUser']>) {
  if (user.status === 'disabled') return '已禁用';
  if (user.workspaceMode === 'readonly') return '只读宽限';
  if (user.workspaceMode === 'expired') return '已到期';
  return '正常使用';
}

export function AdminUserDialog({ admin }: { admin: Controller }) {
  const user = admin.selectedUser;
  if (!user) return null;
  const busy = Boolean(admin.busyAction);
  const title = admin.userDialogView === 'devices' ? '绑定设备'
    : admin.userDialogView === 'phone' ? '修改登录手机号'
      : admin.userDialogView === 'delete' ? '永久删除账户数据'
        : '账户详情';

  let footer: ReactNode = <Button intent="secondary" onClick={() => admin.closeUser()}>完成</Button>;
  if (admin.userDialogView === 'devices') footer = <><Button intent="text" onClick={admin.requestUserOverview}>返回账户</Button><Button intent="secondary" onClick={() => admin.closeUser()}>完成</Button></>;
  if (admin.userDialogView === 'phone') footer = <><Button intent="text" onClick={admin.requestUserOverview}>返回账户</Button><Button form="admin-phone-form" type="submit" intent="primary" busy={admin.busyAction.startsWith('phone-')} disabled={!admin.phoneValid}>确认修改</Button></>;
  if (admin.userDialogView === 'delete') footer = <><Button intent="text" onClick={admin.requestUserOverview}>取消</Button><Button form="admin-delete-form" type="submit" intent="danger" busy={admin.busyAction.startsWith('delete-')} disabled={admin.deleteConfirmation !== user.phone}>确认永久删除</Button></>;

  function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void admin.savePhone();
  }

  function submitDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void admin.deleteUser();
  }

  const pendingCopy = admin.pendingAction?.kind === 'renew'
    ? { title: '为该工作台续期一年？', detail: '期限会从当前有效期或今天较晚的一天开始顺延365天。', label: '确认续期', danger: false }
    : admin.pendingAction?.kind === 'toggle-user'
      ? user.status === 'active'
        ? { title: '禁用这个用户？', detail: '该用户的现有设备会话会全部撤销，恢复账户后仍需重新验证。', label: '确认禁用', danger: true }
        : { title: '恢复这个用户？', detail: '恢复后用户可再次使用原兑换关系和手机号验证进入。', label: '确认恢复', danger: false }
      : admin.pendingAction?.kind === 'revoke-device'
        ? { title: `解绑“${admin.pendingAction.device.device_name}”？`, detail: '该浏览器的会话会立即撤销，其他设备不受影响。', label: '确认解绑', danger: true }
        : null;

  return <Dialog open title={title} size="wide" busy={busy} onRequestClose={() => admin.closeUser()} footer={footer}>
    <div className={styles.userDialog}>
      <aside className={styles.userIdentity}>
        <span><CampusIcon name="user" /></span>
        <p>工作台账户</p>
        <h3>{user.phone}</h3>
        <small>{user.class_name || '未命名班级'}</small>
        <dl>
          <div><dt>账户状态</dt><dd data-status={user.status}>{userStatus(user)}</dd></div>
          <div><dt>工作台期限</dt><dd>{formatAdminDate(user.expires_at)}</dd></div>
          <div><dt>有效设备</dt><dd>{user.active_devices} 台</dd></div>
        </dl>
      </aside>

      <div className={styles.userWork}>
        {pendingCopy && <div className={styles.inlineConfirm} role="alert">
          <CampusIcon name="warning" />
          <p><b>{pendingCopy.title}</b><span>{pendingCopy.detail}</span></p>
          <div><Button intent="secondary" onClick={() => admin.setPendingAction(null)}>取消</Button><Button autoFocus intent={pendingCopy.danger ? 'danger' : 'primary'} onClick={() => void admin.confirmPendingAction()}>{pendingCopy.label}</Button></div>
        </div>}

        {admin.closePrompt && <div className={styles.inlineConfirm} role="alert">
          <CampusIcon name="edit" />
          <p><b>手机号修改尚未提交</b><span>放弃后将恢复当前账户原手机号。</span></p>
          <div><Button intent="secondary" onClick={() => admin.setClosePrompt(null)}>继续编辑</Button><Button autoFocus intent="danger" onClick={admin.discardPhoneChanges}>放弃修改</Button></div>
        </div>}

        {admin.userDialogView === 'overview' && <section className={styles.userOverview} aria-label="账户可用操作">
          <header><p>账户操作</p><h3>先核对对象，再执行变更</h3></header>
          <div className={styles.actionList}>
            <button type="button" onClick={() => void admin.openDevices()}><CampusIcon name="devices" /><span><b>查看绑定设备</b><small>核对设备名称、状态和最近使用日期</small></span><CampusIcon name="chevron" /></button>
            <button type="button" onClick={admin.openPhone}><CampusIcon name="edit" /><span><b>修改登录手机号</b><small>原兑换关系保持，之后使用新号码验证</small></span><CampusIcon name="chevron" /></button>
            <button type="button" onClick={() => admin.setPendingAction({ kind: 'renew' })}><CampusIcon name="schedule" /><span><b>续期一年</b><small>按服务端规则顺延工作台使用期限</small></span><CampusIcon name="chevron" /></button>
            <button type="button" onClick={() => void admin.exportUserData()}><CampusIcon name="copy" /><span><b>导出用户完整数据</b><small>包含账户、工作区、设备和AI用量记录</small></span><CampusIcon name="chevron" /></button>
          </div>
          <div className={styles.dangerZone}>
            <p><b>受控操作</b><span>这些操作会影响用户访问或数据保留。</span></p>
            <div><Button intent="secondary" onClick={() => admin.setPendingAction({ kind: 'toggle-user' })}>{user.status === 'active' ? '禁用用户' : '恢复用户'}</Button><Button intent="danger" onClick={admin.openDelete}>删除账户数据</Button></div>
          </div>
        </section>}

        {admin.userDialogView === 'devices' && <section className={styles.deviceSection} aria-label="设备列表">
          <header><p>设备管理</p><h3>只解绑确认不再使用的浏览器</h3></header>
          {admin.devicesLoading ? <p className={styles.loadingLine} role="status"><CampusIcon name="sync" />正在读取设备…</p> : <div className={styles.deviceList}>
            {admin.devices.map((device) => <article key={device.id}>
              <CampusIcon name="devices" />
              <p><b>{device.device_name}</b><span>最近使用 {formatAdminDate(device.last_seen_at, true)}</span></p>
              <small data-status={device.status}>{device.status === 'active' ? '有效' : '已解绑'}</small>
              {device.status === 'active' && <Button intent="danger" onClick={() => admin.setPendingAction({ kind: 'revoke-device', device })}>解绑</Button>}
            </article>)}
            {!admin.devices.length && <p className={styles.emptyLine}>没有设备记录</p>}
          </div>}
        </section>}

        {admin.userDialogView === 'phone' && <form id="admin-phone-form" className={styles.editorForm} onSubmit={submitPhone}>
          <header><p>账户修正</p><h3>修改登录手机号</h3><span>修改后，原兑换码需要配合新手机号在其他浏览器进入。</span></header>
          <Field id="admin-new-phone" label="新手机号" required error={admin.phoneDraft && !admin.phoneValid ? '请输入正确的11位手机号' : undefined}>
            <Input id="admin-new-phone" autoFocus inputMode="numeric" autoComplete="tel" maxLength={11} value={admin.phoneDraft} onChange={(event) => admin.setPhoneDraft(event.target.value)} />
          </Field>
        </form>}

        {admin.userDialogView === 'delete' && <form id="admin-delete-form" className={styles.deleteForm} onSubmit={submitDelete}>
          <header><p>不可逆操作</p><h3>永久删除账户与全部工作台数据</h3></header>
          <div className={styles.deleteWarning}><CampusIcon name="warning" /><p>将删除 <strong>{user.phone}</strong> 的账户、工作台、设备和全部班级数据。请先导出需要保留的数据。</p></div>
          <Field id="admin-delete-phone" label="输入完整手机号确认" hint="输入不一致时不会执行删除。" required>
            <Input id="admin-delete-phone" autoFocus inputMode="numeric" maxLength={11} placeholder={user.phone} value={admin.deleteConfirmation} onChange={(event) => admin.setDeleteConfirmation(event.target.value)} />
          </Field>
        </form>}
      </div>
    </div>
  </Dialog>;
}
