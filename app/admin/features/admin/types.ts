export type UserRow = {
  id: number;
  phone: string;
  status: 'active' | 'disabled';
  class_name?: string;
  expires_at?: string;
  workspaceMode?: 'active' | 'readonly' | 'expired';
  active_devices: number;
};

export type CodeRow = {
  id: number;
  code: string | null;
  code_hint: string;
  phone: string;
  status: 'active' | 'disabled' | 'used';
  max_devices: number;
  expires_at: number;
  workspace_expires_at?: number;
};

export type DeviceRow = {
  id: number;
  device_name: string;
  status: 'active' | 'revoked';
  last_seen_at: number;
};

export type AuditRow = {
  id: number;
  action: string;
  target_type: string;
  target_id?: string;
  detail?: string;
  source_ip: string;
  created_at: number;
};

export type AdminView = 'users' | 'codes' | 'audit';
export type UserDialogView = 'overview' | 'devices' | 'phone' | 'delete';
export type AdminNotice = { tone: 'success' | 'error' | 'info'; text: string };
export type PendingAdminAction =
  | { kind: 'renew' }
  | { kind: 'toggle-user' }
  | { kind: 'revoke-device'; device: DeviceRow };
