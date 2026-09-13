'use client';

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from './Button';
import { DraftClosePrompt } from './DraftClosePrompt';
import { Drawer } from './Drawer';
import { Field, Input } from './Field';
import { Icon } from './Icon';
import type { CloseReason } from './ModalLayer';
import styles from './student-picker.module.css';

export type StudentPickerItem = {
  id: string;
  name: string;
  studentNo?: string;
  group?: number | string;
  seat?: number | string;
};

export type StudentPickerProps = {
  open: boolean;
  title: string;
  description?: string;
  items: readonly StudentPickerItem[];
  selectedIds?: readonly string[];
  selectionMode?: 'single' | 'multiple';
  pageSize?: number;
  allowEmptySelection?: boolean;
  clearLabel?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (selectedIds: string[]) => void | Promise<void>;
  onRequestClose: (reason: CloseReason) => void;
};

const EMPTY_SELECTION: readonly string[] = [];

function searchable(value: string | number | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase('zh-CN');
}

function studentNumber(item: StudentPickerItem) {
  const parsed = Number(item.studentNo);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function sameIds(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightIds = new Set(right);
  return left.every(id => rightIds.has(id));
}

export function StudentPicker({
  open,
  title,
  description = '按姓名或学号搜索；初屏只显示一页，不展开完整班级名单。',
  items,
  selectedIds = EMPTY_SELECTION,
  selectionMode = 'single',
  pageSize = 12,
  allowEmptySelection = false,
  clearLabel = '清空选择',
  confirmLabel = '确认选择',
  busy = false,
  onConfirm,
  onRequestClose,
}: StudentPickerProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const selectionName = useId();
  const wasOpenRef = useRef(false);
  const [baselineIds, setBaselineIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [page, setPage] = useState(1);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const [pendingCloseReason, setPendingCloseReason] = useState<CloseReason>('button');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const locked = busy || submitting;

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const validIds = new Set(items.map(item => item.id));
      const initialIds = [...new Set(selectedIds.filter(id => validIds.has(id)))];
      setBaselineIds(initialIds);
      setDraftIds(initialIds);
      setQuery('');
      setPage(1);
      setClosePromptOpen(false);
      setSubmitError('');
    }
    wasOpenRef.current = open;
  }, [items, open, selectedIds]);

  const sortedItems = useMemo(() => [...items].sort((left, right) =>
    studentNumber(left) - studentNumber(right)
      || searchable(left.studentNo).localeCompare(searchable(right.studentNo), 'zh-CN', { numeric: true })
      || left.name.localeCompare(right.name, 'zh-CN')
  ), [items]);

  const filteredItems = useMemo(() => {
    const keyword = searchable(deferredQuery);
    if (!keyword) return sortedItems;
    return sortedItems
      .map((item, index) => {
        const name = searchable(item.name);
        const studentNo = searchable(item.studentNo);
        const rank = name === keyword || studentNo === keyword ? 0
          : name.startsWith(keyword) || studentNo.startsWith(keyword) ? 1
            : name.includes(keyword) || studentNo.includes(keyword) ? 2 : 3;
        return { item, index, rank };
      })
      .filter(result => result.rank < 3)
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .map(result => result.item);
  }, [deferredQuery, sortedItems]);

  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / safePageSize));
  const safePage = Math.min(page, totalPages);
  const visibleItems = filteredItems.slice((safePage - 1) * safePageSize, safePage * safePageSize);
  const selectedSet = useMemo(() => new Set(draftIds), [draftIds]);
  const dirty = !sameIds(draftIds, baselineIds);
  const canConfirm = allowEmptySelection || draftIds.length > 0;
  const visibleAllSelected = visibleItems.length > 0 && visibleItems.every(item => selectedSet.has(item.id));
  const resultAllSelected = filteredItems.length > 0 && filteredItems.every(item => selectedSet.has(item.id));

  useEffect(() => setPage(1), [deferredQuery]);

  useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  function setSingle(id: string) {
    setDraftIds([id]);
    setSubmitError('');
  }

  function toggleMultiple(id: string) {
    setDraftIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    setSubmitError('');
  }

  function setScope(scopeItems: readonly StudentPickerItem[], selected: boolean) {
    const scopeIds = new Set(scopeItems.map(item => item.id));
    setDraftIds(current => selected
      ? [...new Set([...current, ...scopeIds])]
      : current.filter(id => !scopeIds.has(id)));
    setSubmitError('');
  }

  function requestClose(reason: CloseReason) {
    if (locked) return;
    if (dirty) {
      setPendingCloseReason(reason);
      setClosePromptOpen(true);
      return;
    }
    onRequestClose(reason);
  }

  async function confirm() {
    if (!canConfirm || locked) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onConfirm(draftIds);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '选择未能提交，请保留当前内容后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <Drawer
      open={open}
      title={title}
      description={description}
      busy={locked}
      dirty={dirty}
      initialFocusRef={searchRef}
      onRequestClose={requestClose}
      footer={<div className={styles.footer}>
        <p aria-live="polite">已选 <strong>{draftIds.length}</strong> 人</p>
        <div>
          {allowEmptySelection && <Button intent="text" disabled={locked || draftIds.length === 0} onClick={() => setDraftIds([])}>{clearLabel}</Button>}
          <Button intent="secondary" disabled={locked} onClick={() => requestClose('button')}>取消</Button>
          <Button intent="primary" busy={submitting} disabled={!canConfirm || busy} onClick={() => void confirm()}>{confirmLabel}</Button>
        </div>
      </div>}
    >
      <div className={styles.picker}>
        <Field id={searchId} label="搜索学生" hint="姓名和学号优先匹配；小组不是必填条件。">
          <span className={styles.searchField}><Icon name="search" /><Input ref={searchRef} id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="输入姓名或学号" disabled={locked} hint="姓名和学号优先匹配；小组不是必填条件。" /></span>
        </Field>

        <div className={styles.resultSummary}>
          <p>{query ? `找到 ${filteredItems.length} 人` : `全班 ${items.length} 人`}<span>第 {safePage} / {totalPages} 页</span></p>
          {selectionMode === 'multiple' && filteredItems.length > 0 && <div aria-label="选择范围">
            <Button intent="text" disabled={locked} onClick={() => setScope(visibleItems, !visibleAllSelected)}>{visibleAllSelected ? '取消本页' : `选择本页 ${visibleItems.length} 人`}</Button>
            <Button intent="text" disabled={locked} onClick={() => setScope(filteredItems, !resultAllSelected)}>{resultAllSelected ? '取消当前结果' : `选择全部结果 ${filteredItems.length} 人`}</Button>
          </div>}
        </div>

        <div className={styles.list} role={selectionMode === 'single' ? 'radiogroup' : 'group'} aria-label="学生名单">
          {visibleItems.map(item => {
            const selected = selectedSet.has(item.id);
            return <label key={item.id} className={styles.student} data-selected={selected || undefined}>
              <input
                type={selectionMode === 'single' ? 'radio' : 'checkbox'}
                name={selectionMode === 'single' ? selectionName : undefined}
                checked={selected}
                disabled={locked}
                onChange={() => selectionMode === 'single' ? setSingle(item.id) : toggleMultiple(item.id)}
              />
              <span className={styles.identity}><strong>{item.name}</strong><small>学号 {item.studentNo || '未填'}</small></span>
              <span className={styles.meta}>{item.group ? `第${item.group}组` : '未分组'}{item.seat ? ` · ${item.seat}号座` : ''}</span>
            </label>;
          })}
          {!visibleItems.length && <div className={styles.noResults}><Icon name="search" /><strong>没有找到学生</strong><p>请检查姓名或学号，搜索不会依赖小组信息。</p></div>}
        </div>

        <nav className={styles.pagination} aria-label="学生名单分页">
          <Button intent="secondary" disabled={locked || safePage <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>上一页</Button>
          <span>{filteredItems.length ? `${(safePage - 1) * safePageSize + 1}-${Math.min(filteredItems.length, safePage * safePageSize)} / ${filteredItems.length}` : '0 人'}</span>
          <Button intent="secondary" disabled={locked || safePage >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>下一页</Button>
        </nav>

        {submitError && <div ref={errorRef} className={styles.error} role="alert" tabIndex={-1}><Icon name="warning" /><p><strong>提交失败</strong><span>{submitError}</span></p></div>}
      </div>
    </Drawer>
    <DraftClosePrompt
      open={open && closePromptOpen}
      title="放弃本次学生选择？"
      description="已勾选的学生范围尚未确认。继续编辑可保留当前搜索、页码和选择。"
      discardLabel="放弃本次选择"
      onContinue={() => setClosePromptOpen(false)}
      onDiscard={() => {
        setClosePromptOpen(false);
        onRequestClose(pendingCloseReason);
      }}
    />
  </>;
}
