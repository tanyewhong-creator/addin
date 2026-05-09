/**
 * Tiny fetch wrapper for upstream FastAPI dashboard backend.
 * The dev server in Vite proxies /api/* to upstream web_server.py
 * (configured via vite.config.ts server.proxy block).
 *
 * The upstream auth middleware requires the ephemeral session token
 * on every /api/* call (except a small public-paths set). The token
 * is injected into the served index.html as window.__HERMES_SESSION_TOKEN__
 * by hermes_cli/web_server.py at line ~3227. Every request below picks
 * it up automatically.
 */

declare global {
  interface Window {
    __HERMES_SESSION_TOKEN__?: string;
  }
}

const SESSION_HEADER = "X-Hermes-Session-Token";

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

function withSessionToken(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token =
    typeof window !== "undefined" ? window.__HERMES_SESSION_TOKEN__ : undefined;
  if (token && !headers.has(SESSION_HEADER)) {
    headers.set(SESSION_HEADER, token);
  }
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: withSessionToken() });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "PUT",
    headers: withSessionToken({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method: "POST",
    headers: withSessionToken(
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    ),
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}
