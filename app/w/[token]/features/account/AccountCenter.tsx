'use client';

import { useEffect, useRef, useState } from 'react';
import type { RosterClass } from '@/lib/classroom';
import { CampusIcon } from '@/app/components/campus/primitives';
import { ThemeBoundary } from '@/app/components/workbench/theme/ThemeBoundary';
import { Button } from '@/app/components/workbench/ui/Button';
import { Dialog } from '@/app/components/workbench/ui/Dialog';
import { Field, Input, Select } from '@/app/components/workbench/ui/Field';
import type { AccountDetails } from './useAccountCenter';
import styles from './AccountCenter.module.css';

function expiryLabel(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN');
}

export function AccountCenter({
  open,
  account,
  loading,
  loadError,
  classes,
  activeClass,
  saving,
  dirty,
  saveError,
  isDemo,
  isReadOnly,
  onClose,
  onRetryAccount,
  onSwitchClass,
  onPatchClass,
  onAddClass,
  onDeleteClass,
  onExport,
  onImport,
  onLogout,
}: {
  open: boolean;
  account: AccountDetails | null;
  loading: boolean;
  loadError: string;
  classes: RosterClass[];
  activeClass: RosterClass;
  saving: boolean;
  dirty: boolean;
  saveError: string;
  isDemo: boolean;
  isReadOnly: boolean;
  onClose: () => void;
  onRetryAccount: () => void;
  onSwitchClass: (id: string) => void;
  onPatchClass: (patch: Pick<Partial<RosterClass>, 'name' | 'grade' | 'term'>) => void;
  onAddClass: () => void;
  onDeleteClass: () => Promise<void>;
  onExport: () => void;
  onImport: () => void;
  onLogout: () => Promise<boolean>;
}) {
  const [pendingAction, setPendingAction] = useState<'delete-class' | 'logout' | null>(null);
  const [performingAction, setPerformingAction] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const locked = isDemo || isReadOnly;
  const saveLabel = isDemo
    ? '演示数据不会保存'
    : isReadOnly
      ? '到期只读，可导出备份'
      : saveError
        ? '同步失败，本机草稿仍保留'
        : saving
          ? '正在同步班级资料'
          : dirty
            ? '修改已保存到本机，等待同步'
            : '班级资料已同步';

  useEffect(() => {
    if (pendingAction) confirmRef.current?.focus();
  }, [pendingAction]);

  function switchClass(id: string) {
    setPendingAction(null);
    onSwitchClass(id);
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    setPerformingAction(true);
    try {
      if (pendingAction === 'delete-class') await onDeleteClass();
      else await onLogout();
      setPendingAction(null);
    } finally {
      setPerformingAction(false);
    }
  }

  return <ThemeBoundary>
    <Dialog
      open={open}
      title={isDemo ? '演示工作台说明' : '账户与班级'}
      size="wide"
      busy={performingAction}
      onRequestClose={onClose}
      footer={<div className={styles.footer}>
        <p data-tone={saveError ? 'error' : 'normal'}><CampusIcon name={saveError ? 'warning' : saving ? 'sync' : 'check'} />{saveLabel}</p>
        <div>
          {!isDemo && <Button intent="text" disabled={performingAction} onClick={() => setPendingAction('logout')}><CampusIcon name="user" />退出当前设备</Button>}
          <Button intent="secondary" disabled={performingAction} onClick={onClose}>完成</Button>
        </div>
      </div>}
    >
      <div className={styles.layout}>
        <aside className={styles.accountRail}>
          <span className={styles.accountMark}><CampusIcon name={isDemo ? 'view' : 'user'} /></span>
          <p className={styles.eyebrow}>{isDemo ? '只读体验' : '当前账户'}</p>
          <h3>{isDemo ? '示例数据工作台' : account?.phone || '正在读取…'}</h3>
          <p className={styles.accountNote}>{isDemo ? '可查看页面与流程，编辑不会写入正式数据。' : '这里只显示当前登录设备和工作台使用期限，不提供未完成的在线续费入口。'}</p>

          {!isDemo && loading && <p className={styles.loading} role="status"><CampusIcon name="sync" />正在读取账户信息…</p>}
          {!isDemo && loadError && <div className={styles.loadError} role="alert"><CampusIcon name="warning" /><p>{loadError}</p><Button intent="secondary" onClick={onRetryAccount}>重新读取</Button></div>}
          {!isDemo && account && !loading && !loadError && <dl className={styles.accountFacts}>
            <div><dt>使用状态</dt><dd><span data-mode={account.mode}>{account.mode === 'readonly' ? '只读宽限期' : '正常使用'}</span></dd></div>
            <div><dt>使用期限</dt><dd>{expiryLabel(account.expiresAt)}</dd></div>
            <div><dt>当前设备</dt><dd>{account.deviceName}</dd></div>
          </dl>}
        </aside>

        <div className={styles.workspace}>
          {pendingAction && <div className={styles.dangerConfirm} role="alert">
            <CampusIcon name="warning" />
            <p><b>{pendingAction === 'delete-class' ? `删除“${activeClass.name || '未命名班级'}”？` : '退出当前设备？'}</b><span>{pendingAction === 'delete-class' ? '该班学生、作业、考试、周报和相关记录会一起移除。' : '当前浏览器会解除绑定，再次进入需要重新验证；其他设备不受影响。'}</span></p>
            <div className={styles.confirmActions}>
              <Button intent="secondary" disabled={performingAction} onClick={() => setPendingAction(null)}>取消</Button>
              <Button ref={confirmRef} intent="danger" busy={performingAction} onClick={() => void confirmPendingAction()}>{pendingAction === 'delete-class' ? '确认删除' : '确认退出'}</Button>
            </div>
          </div>}
          <section className={styles.section} aria-labelledby="account-class-title">
            <header className={styles.sectionHeader}>
              <div><p>班级上下文</p><h3 id="account-class-title">班级资料</h3></div>
              <span>{classes.length} 个班级</span>
            </header>
            <div className={styles.classWorkspace}>
              <div className={styles.classList} role="list" aria-label="班级列表">
                {classes.map((item) => <button key={item.id} type="button" role="listitem" aria-current={item.id === activeClass.id ? 'true' : undefined} onClick={() => switchClass(item.id)}>
                  <span>{item.name || '未命名班级'}</span><small>{item.grade || '未填写年级'} · {item.students.length}人</small>
                </button>)}
              </div>
              <div className={styles.classEditor}>
                <div className={styles.editorHeading}><CampusIcon name="school" /><p><b>{activeClass.name || '未命名班级'}</b><span>{locked ? '当前模式只能查看' : '修改后写入本机草稿并自动同步'}</span></p></div>
                <div className={styles.fields}>
                  <Field id="account-class-name" label="班级名称"><Input id="account-class-name" value={activeClass.name} maxLength={40} disabled={locked} onChange={(event) => onPatchClass({ name: event.target.value })} /></Field>
                  <Field id="account-class-grade" label="年级"><Input id="account-class-grade" value={activeClass.grade} maxLength={24} disabled={locked} onChange={(event) => onPatchClass({ grade: event.target.value })} /></Field>
                  <Field id="account-class-term" label="学期"><Input id="account-class-term" value={activeClass.term} maxLength={60} disabled={locked} onChange={(event) => onPatchClass({ term: event.target.value })} /></Field>
                  <Field id="account-active-class" label="当前班级"><Select id="account-active-class" value={activeClass.id} onChange={(event) => switchClass(event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name || '未命名班级'}（{item.students.length}人）</option>)}</Select></Field>
                </div>
                {!locked && <div className={styles.classActions}>
                  <Button intent="secondary" onClick={onAddClass}><CampusIcon name="plus" />新建空白班级</Button>
                  <Button intent="danger" disabled={classes.length <= 1} onClick={() => setPendingAction('delete-class')}><CampusIcon name="trash" />删除当前班级</Button>
                </div>}
              </div>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="account-backup-title">
            <header className={styles.sectionHeader}>
              <div><p>本地文件</p><h3 id="account-backup-title">完整备份</h3></div>
              <span>JSON · 上限 5MB</span>
            </header>
            <p className={styles.backupCopy}>{isReadOnly ? '只读宽限期仍可导出完整备份；续期后才能恢复。' : '恢复前会先检查格式、重复标识、班级与听写数据，再列出将被替换的内容并要求确认。'}</p>
            <div className={styles.backupActions}>
              {!isDemo && <Button intent="secondary" onClick={onExport}><CampusIcon name="copy" />导出完整备份</Button>}
              {!isDemo && <Button intent="secondary" disabled={isReadOnly} onClick={onImport}><CampusIcon name="arrow" />选择备份并预检</Button>}
              {isDemo && <p><CampusIcon name="view" />演示工作台不提供正式数据导入或导出。</p>}
            </div>
          </section>
        </div>
      </div>
    </Dialog>
  </ThemeBoundary>;
}
