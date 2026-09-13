'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { copyTextToClipboard } from '@/lib/clipboard';
import { adminApi, AdminApiError } from './api';
import type { AdminNotice, AdminView, AuditRow, CodeRow, DeviceRow, PendingAdminAction, UserDialogView, UserRow } from './types';

const phonePattern = /^1[3-9]\d{9}$/;

export function useAdminConsole() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [view, setView] = useState<AdminView>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [userQuery, setUserQueryState] = useState('');
  const [codeQuery, setCodeQueryState] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [codePage, setCodePage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [codeTotal, setCodeTotal] = useState(0);
  const [userSummaryTotal, setUserSummaryTotal] = useState(0);
  const [codeSummaryTotal, setCodeSummaryTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [notice, setNotice] = useState<AdminNotice | null>(null);
  const [loadError, setLoadError] = useState('');
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [codeLength, setCodeLength] = useState(8);
  const [maxDevices, setMaxDevices] = useState(2);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userDialogView, setUserDialogView] = useState<UserDialogView>('overview');
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [phoneDraft, setPhoneDraftState] = useState('');
  const [deleteConfirmation, setDeleteConfirmationState] = useState('');
  const [closePrompt, setClosePrompt] = useState<'close' | 'overview' | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const loadSequence = useRef(0);

  const showError = useCallback((error: unknown, fallback = '操作失败') => {
    setNotice({ tone: 'error', text: error instanceof Error ? error.message : fallback });
  }, []);

  const load = useCallback(async (quiet = false) => {
    const sequence = ++loadSequence.current;
    if (!quiet) setLoading(true);
    setLoadError('');
    try {
      const [userData, codeData, auditData] = await Promise.all([
        adminApi<{ users: UserRow[]; total: number }>(`/api/admin/users?q=${encodeURIComponent(userQuery)}&page=${userPage}`),
        adminApi<{ codes: CodeRow[]; total: number }>(`/api/admin/redeem-codes?q=${encodeURIComponent(codeQuery)}&page=${codePage}`),
        adminApi<{ logs: AuditRow[] }>('/api/admin/audit-logs'),
      ]);
      if (sequence !== loadSequence.current) return;
      setUsers(userData.users);
      setCodes(codeData.codes);
      setUserTotal(userData.total);
      setCodeTotal(codeData.total);
      if (!userQuery) setUserSummaryTotal(userData.total);
      if (!codeQuery) setCodeSummaryTotal(codeData.total);
      setAuditLogs(auditData.logs);
      setSelectedUser((current) => current ? userData.users.find((item) => item.id === current.id) ?? current : null);
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
        setAuthenticated(false);
        setNotice({ tone: 'error', text: error.message });
      } else {
        setLoadError(error instanceof Error ? error.message : '管理数据读取失败');
      }
    } finally {
      if (sequence === loadSequence.current && !quiet) setLoading(false);
    }
  }, [codePage, codeQuery, userPage, userQuery]);

  useEffect(() => {
    let active = true;
    adminApi<{ authenticated: boolean }>('/api/admin/session')
      .then(() => { if (active) setAuthenticated(true); })
      .catch((error) => {
        if (!active) return;
        setAuthenticated(false);
        if (!(error instanceof AdminApiError) || error.status >= 500) {
          setNotice({ tone: 'error', text: error instanceof Error ? error.message : '无法检查管理权限' });
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);

  async function login() {
    setBusyAction('login');
    setNotice(null);
    try {
      await adminApi('/api/admin/session', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword('');
      setAuthenticated(true);
    } catch (error) {
      showError(error, '登录失败');
    } finally {
      setBusyAction('');
    }
  }

  async function logout() {
    setBusyAction('logout');
    try {
      await adminApi('/api/admin/session', { method: 'DELETE' });
      setAuthenticated(false);
      setSelectedUser(null);
      setNotice({ tone: 'success', text: '已退出管理员后台' });
    } catch (error) {
      showError(error, '退出失败');
    } finally {
      setBusyAction('');
    }
  }

  async function runMutation<T>(key: string, url: string, init: RequestInit, success: string) {
    setBusyAction(key);
    setNotice(null);
    try {
      const result = await adminApi<T>(url, init);
      setNotice({ tone: 'success', text: success });
      await load(true);
      return result;
    } catch (error) {
      showError(error);
      return null;
    } finally {
      setBusyAction('');
    }
  }

  async function generateCodes() {
    const result = await runMutation<{ codes: string[] }>('generate-codes', '/api/admin/redeem-codes', {
      method: 'POST', body: JSON.stringify({ maxDevices, validDays: 30, quantity, codeLength }),
    }, `已生成 ${quantity} 个兑换码`);
    if (result) {
      setNewCodes(result.codes);
      if (codeQuery) setCodeSummaryTotal((current) => current + result.codes.length);
    }
  }

  async function toggleCode(item: CodeRow) {
    await runMutation(`code-${item.id}`, `/api/admin/redeem-codes/${item.id}`, {
      method: 'PATCH', body: JSON.stringify({ status: item.status === 'active' ? 'disabled' : 'active' }),
    }, item.status === 'active' ? '兑换码已禁用' : '兑换码已启用');
  }

  async function copyCodes(values: string[], message: string) {
    const copied = await copyTextToClipboard(values.join('\n'), message);
    setNotice(copied
      ? { tone: 'success', text: message }
      : { tone: 'error', text: '浏览器未允许复制，请检查权限后重试' });
    return copied;
  }

  function openUser(user: UserRow) {
    setSelectedUser(user);
    setUserDialogView('overview');
    setPendingAction(null);
    setClosePrompt(null);
  }

  function closeUser(force = false) {
    if (!force && userDialogView === 'phone' && selectedUser && phoneDraft !== selectedUser.phone) {
      setClosePrompt('close');
      return;
    }
    setSelectedUser(null);
    setUserDialogView('overview');
    setPendingAction(null);
    setClosePrompt(null);
    setDeleteConfirmationState('');
  }

  function openPhone() {
    if (!selectedUser) return;
    setPhoneDraftState(selectedUser.phone);
    setClosePrompt(null);
    setPendingAction(null);
    setUserDialogView('phone');
  }

  function setPhoneDraft(value: string) {
    setPhoneDraftState(value.replace(/\D/g, '').slice(0, 11));
    setClosePrompt(null);
  }

  async function savePhone() {
    if (!selectedUser || !phonePattern.test(phoneDraft)) return;
    const result = await runMutation(`phone-${selectedUser.id}`, `/api/admin/users/${selectedUser.id}`, {
      method: 'PATCH', body: JSON.stringify({ phone: phoneDraft, status: selectedUser.status }),
    }, '手机号已更新，用户下次可使用新手机号进入');
    if (result) {
      setSelectedUser({ ...selectedUser, phone: phoneDraft });
      setUserDialogView('overview');
      setClosePrompt(null);
    }
  }

  async function openDevices() {
    if (!selectedUser) return;
    setUserDialogView('devices');
    setPendingAction(null);
    setDevicesLoading(true);
    try {
      const result = await adminApi<{ devices: DeviceRow[] }>(`/api/admin/users/${selectedUser.id}/devices`);
      setDevices(result.devices);
    } catch (error) {
      showError(error, '设备读取失败');
    } finally {
      setDevicesLoading(false);
    }
  }

  function requestUserOverview() {
    if (userDialogView === 'phone' && selectedUser && phoneDraft !== selectedUser.phone) {
      setClosePrompt('overview');
      return;
    }
    setUserDialogView('overview');
    setPendingAction(null);
  }

  function discardPhoneChanges() {
    if (!selectedUser) return;
    const target = closePrompt;
    setPhoneDraftState(selectedUser.phone);
    setClosePrompt(null);
    if (target === 'close') closeUser(true);
    else setUserDialogView('overview');
  }

  async function exportUserData() {
    if (!selectedUser) return;
    setBusyAction(`export-${selectedUser.id}`);
    setNotice(null);
    try {
      const result = await adminApi<Record<string, unknown>>(`/api/admin/users/${selectedUser.id}/data`);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `classroom-user-${selectedUser.phone}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice({ tone: 'success', text: '用户完整数据已导出' });
      await load(true);
    } catch (error) {
      showError(error, '用户数据导出失败');
    } finally {
      setBusyAction('');
    }
  }

  function openDelete() {
    setDeleteConfirmationState('');
    setPendingAction(null);
    setUserDialogView('delete');
  }

  function setDeleteConfirmation(value: string) {
    setDeleteConfirmationState(value.replace(/\D/g, '').slice(0, 11));
  }

  async function deleteUser() {
    if (!selectedUser || deleteConfirmation !== selectedUser.phone) return;
    const result = await runMutation(`delete-${selectedUser.id}`, `/api/admin/users/${selectedUser.id}/data`, {
      method: 'DELETE', body: JSON.stringify({ confirmation: deleteConfirmation }),
    }, '用户账户和工作台数据已永久删除');
    if (result) {
      if (userQuery) setUserSummaryTotal((current) => Math.max(0, current - 1));
      closeUser(true);
    }
  }

  async function confirmPendingAction() {
    if (!selectedUser || !pendingAction) return;
    if (pendingAction.kind === 'renew') {
      const result = await runMutation<{ expiresAt: string }>(`renew-${selectedUser.id}`, `/api/admin/users/${selectedUser.id}/renew`, { method: 'POST' }, '工作台已续期一年');
      if (result) setSelectedUser({ ...selectedUser, expires_at: result.expiresAt, workspaceMode: 'active' });
    } else if (pendingAction.kind === 'toggle-user') {
      const nextStatus = selectedUser.status === 'active' ? 'disabled' : 'active';
      const result = await runMutation(`status-${selectedUser.id}`, `/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH', body: JSON.stringify({ status: nextStatus }),
      }, nextStatus === 'disabled' ? '用户已禁用，现有会话已撤销' : '用户已恢复');
      if (result) setSelectedUser({ ...selectedUser, status: nextStatus, active_devices: nextStatus === 'disabled' ? 0 : selectedUser.active_devices });
    } else {
      const result = await runMutation(`device-${pendingAction.device.id}`, `/api/admin/devices/${pendingAction.device.id}`, { method: 'DELETE' }, '浏览器已解绑');
      if (result) await openDevices();
    }
    setPendingAction(null);
  }

  function setUserQuery(value: string) { setUserQueryState(value); setUserPage(1); }
  function setCodeQuery(value: string) { setCodeQueryState(value); setCodePage(1); }

  return {
    authenticated, password, setPassword, login, logout,
    view, setView, users, codes, auditLogs, userTotal, codeTotal, userSummaryTotal, codeSummaryTotal,
    userQuery, setUserQuery, codeQuery, setCodeQuery, userPage, setUserPage, codePage, setCodePage,
    loading, loadError, reload: () => load(), busyAction, notice, setNotice,
    newCodes, quantity, setQuantity, codeLength, setCodeLength, maxDevices, setMaxDevices, generateCodes, toggleCode,
    copyCodes,
    selectedUser, userDialogView, setUserDialogView, openUser, closeUser, requestUserOverview,
    devices, devicesLoading, openDevices,
    phoneDraft, setPhoneDraft, phoneValid: phonePattern.test(phoneDraft), openPhone, savePhone,
    deleteConfirmation, setDeleteConfirmation, openDelete, deleteUser,
    exportUserData, pendingAction, setPendingAction, confirmPendingAction, closePrompt, setClosePrompt, discardPhoneChanges,
  };
}
