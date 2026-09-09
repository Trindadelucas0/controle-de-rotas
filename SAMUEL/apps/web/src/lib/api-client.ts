export type ApiErrorBody = {
  statusCode?: number;
  code?: string;
  message?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  body?: ApiErrorBody;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.status = status;
    this.code = body?.code;
    this.body = body;
  }
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL === undefined ||
  process.env.NEXT_PUBLIC_API_URL === '' ||
  process.env.NEXT_PUBLIC_API_URL === 'same-origin'
    ? ''
    : process.env.NEXT_PUBLIC_API_URL;

let refreshPromise: Promise<boolean> | null = null;
let clearingSession = false;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Limpa cookies httpOnly via API e manda para login (quebra loop / ↔ /login). */
async function clearSessionAndGoLogin() {
  if (typeof window === 'undefined' || clearingSession) return;
  clearingSession = true;
  try {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // ignore
  }
  window.location.replace('/login');
}

function isProbablyHtml(value: string): boolean {
  const t = value.trimStart();
  return /^<!DOCTYPE html/i.test(t) || /^<html[\s>]/i.test(t);
}

function publicApiErrorMessage(
  status: number,
  body: ApiErrorBody,
  rawText: string,
): string {
  const raw = typeof body.message === 'string' ? body.message : rawText;
  if (
    isProbablyHtml(raw) ||
    /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /i.test(raw.trim())
  ) {
    return 'Não foi possível concluir a solicitação. Recarregue a página e tente de novo.';
  }
  if (body.message) return body.message;
  if (status === 429) return 'Muitas tentativas. Aguarde e tente de novo.';
  return 'Não foi possível concluir a solicitação.';
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  opts?: { retryOn401?: boolean; authRedirect?: boolean },
): Promise<T> {
  const retryOn401 = opts?.retryOn401 ?? true;
  const authRedirect = opts?.authRedirect ?? true;
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && retryOn401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, { retryOn401: false, authRedirect });
    }
    if (authRedirect) {
      await clearSessionAndGoLogin();
      throw new ApiError(401, 'Sessão expirada.');
    }
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && authRedirect) {
      await clearSessionAndGoLogin();
    }
    const body = (data || {}) as ApiErrorBody;
    throw new ApiError(
      res.status,
      publicApiErrorMessage(res.status, body, text),
      body,
    );
  }

  return data as T;
}

/** Multipart upload (não define Content-Type — o browser envia boundary). */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  opts?: { retryOn401?: boolean; authRedirect?: boolean },
): Promise<T> {
  const retryOn401 = opts?.retryOn401 ?? true;
  const authRedirect = opts?.authRedirect ?? true;
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (res.status === 401 && retryOn401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiUpload<T>(path, formData, { retryOn401: false, authRedirect });
    }
    if (authRedirect) {
      await clearSessionAndGoLogin();
      throw new ApiError(401, 'Sessão expirada.');
    }
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && authRedirect) {
      await clearSessionAndGoLogin();
    }
    const body = (data || {}) as ApiErrorBody;
    throw new ApiError(
      res.status,
      publicApiErrorMessage(res.status, body, text),
      body,
    );
  }

  return data as T;
}
