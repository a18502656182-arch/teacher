export class AdminApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function adminApi<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new AdminApiError('网络连接失败，请检查后重试', 0);
  }
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new AdminApiError(body.error || '操作失败', response.status);
  return body;
}
