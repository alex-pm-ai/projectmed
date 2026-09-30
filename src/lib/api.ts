import { useAuthStore } from '../store/authStore';

// No PC a API roda à parte (porta 3333); publicada (Vercel) ela fica no mesmo endereço, em /api.
export const API_URL =
  import.meta.env.VITE_API_URL || (location.hostname === 'localhost' ? 'http://localhost:3333' : '/api');

export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;
  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

interface Init {
  method: string;
  body?: string;
}

async function request<T>(path: string, init: Init, retry = true): Promise<T> {
  const { accessToken, usuario } = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  // credentials: 'include' envia o cookie httpOnly da sessão (usado só pelas rotas /auth).
  const res = await fetch(API_URL + path, { method: init.method, body: init.body, headers, credentials: 'include' });

  // Token expirado → tenta refresh uma vez e repete
  if (res.status === 401 && retry && usuario && !path.startsWith('/auth/')) {
    const ok = await useAuthStore.getState().tentarRefresh();
    if (ok) return request<T>(path, init, false);
    void useAuthStore.getState().logout();
  }

  if (res.status === 204) return null as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* corpo vazio */
  }

  if (!res.ok) {
    const d = data as { message?: string; error?: string; code?: string } | null;
    if (res.status === 402) useAuthStore.getState().marcarAssinaturaInativa();
    throw new ApiError(res.status, d?.message ?? 'Erro de rede', d?.code ?? d?.error, data);
  }

  return data as T;
}

export const api = {
  get: <T = unknown>(p: string) => request<T>(p, { method: 'GET' }),
  post: <T = unknown>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T = unknown>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T = unknown>(p: string) => request<T>(p, { method: 'DELETE' }),
};
