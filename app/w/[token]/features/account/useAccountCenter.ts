'use client';

import { useCallback, useState } from 'react';

export type AccountDetails = {
  phone: string;
  expiresAt: string;
  deviceName: string;
  mode: 'active' | 'readonly';
};

export function useAccountCenter(isDemo: boolean) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [account, setAccount] = useState<AccountDetails | null>(null);

  const load = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const body = await response.json().catch(() => ({})) as {
        user?: { phone?: string };
        workspace?: { expiresAt?: string; mode?: 'active' | 'readonly' };
        device?: { name?: string };
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || '账户信息读取失败');
      setAccount({
        phone: body.user?.phone ?? '—',
        expiresAt: body.workspace?.expiresAt ?? '',
        deviceName: body.device?.name ?? '当前设备',
        mode: body.workspace?.mode === 'readonly' ? 'readonly' : 'active',
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '账户信息读取失败');
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  const openCenter = useCallback(() => {
    setOpen(true);
    if (!isDemo) void load();
  }, [isDemo, load]);

  return {
    open,
    account,
    loading,
    error,
    openCenter,
    closeCenter: () => setOpen(false),
    reload: load,
  };
}
