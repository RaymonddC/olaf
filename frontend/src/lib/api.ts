import { getAuthToken, refreshAuthToken } from './firebase';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// ── Error types ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip auth token (for public endpoints) */
  skipAuth?: boolean;
}

async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { body, skipAuth = false, headers: extraHeaders, ...rest } = options;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string>),
  };

  if (!skipAuth) {
    let token = await getAuthToken();
    if (!token) {
      // Try refreshing once
      token = await refreshAuthToken();
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(response.status, 'PARSE_ERROR', response.statusText);
    }
    return undefined as T;
  }

  if (!response.ok) {
    // Match api-contracts.md error format: { status: "error", errorMessage: "..." }
    // Also handle legacy { error: { code, message, details? } } format
    const body = data as {
      errorMessage?: string;
      error?: { code?: string; message?: string; details?: unknown };
    };
    const errorMessage =
      body?.errorMessage ??
      body?.error?.message ??
      `HTTP ${response.status}`;
    const errorCode = body?.error?.code ?? 'UNKNOWN';
    throw new ApiError(
      response.status,
      errorCode,
      errorMessage,
      body?.error?.details,
    );
  }

  return data as T;
}

// ── Typed convenience methods ────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, options?: Omit<FetchOptions, 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

export default api;
