/**
 * Tiny fetch wrapper for upstream FastAPI dashboard backend.
 * The dev server in Vite proxies /api/* to upstream web_server.py
 * (configured via vite.config.ts server.proxy block).
 */

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}
