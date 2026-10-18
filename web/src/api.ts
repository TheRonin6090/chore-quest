// Small fetch wrapper. Kiosk sessions send a bearer token kept in memory; the parent web
// page relies on its cookie. Safari 12's fetch needs `credentials` set explicitly.

import { noteServerTime } from './serverClock';
import type { AppState } from './types';

let token: string | null = null;

export function setToken(t: string | null): void {
  token = t;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new ApiError(0, 'timeout', 'The server is not answering.')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await timeout(
      fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        cache: 'no-store',
      }),
      10000,
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'offline', 'Cannot reach the server.');
  }
  const text = await res.text();
  let data: { error?: string; message?: string } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Non-JSON error body.
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'error', data.message || `Request failed (${res.status})`);
  return data as T;
}

export const get = <T>(url: string) => api<T>('GET', url);
export const post = <T>(url: string, body: unknown = {}) => api<T>('POST', url, body);
export const put = <T>(url: string, body: unknown) => api<T>('PUT', url, body);

export async function fetchState(): Promise<AppState> {
  const sent = Date.now();
  const state = await get<AppState>('/api/state');
  noteServerTime(state.now, sent, Date.now(), state.tzOffsetMinutes);
  return state;
}
