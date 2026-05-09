import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiGet, apiPost, apiPut, ApiError } from "./api";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  delete (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__;
});

describe("apiGet", () => {
  it("calls /api<path> and returns parsed JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ x: 1 }),
    });
    const out = await apiGet<{ x: number }>("/config");
    expect(fetchMock).toHaveBeenCalledWith("/api/config", expect.objectContaining({}));
    expect(out).toEqual({ x: 1 });
  });

  it("throws ApiError on non-2xx", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("oops"),
    });
    await expect(apiGet("/config")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("apiPut", () => {
  it("PUTs JSON body to /api<path> and returns parsed JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    const out = await apiPut<{ ok: boolean }>("/config", { a: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/config",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ a: 1 }),
      }),
    );
    expect(out).toEqual({ ok: true });
  });
});

describe("api.ts session-token injection", () => {
  it("apiGet sends X-Hermes-Session-Token when window token is set", async () => {
    (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__ = "abc123token";
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await apiGet("/test");
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("X-Hermes-Session-Token")).toBe("abc123token");
  });

  it("apiPost sends X-Hermes-Session-Token", async () => {
    (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__ = "post-token";
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await apiPost("/some/action");
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("X-Hermes-Session-Token")).toBe("post-token");
    expect(init.method).toBe("POST");
  });

  it("apiGet omits the header when no token is injected", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await apiGet("/test");
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.has("X-Hermes-Session-Token")).toBe(false);
  });

  it("apiGet throws ApiError on non-OK response carrying status code", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("nope"),
    });
    await expect(apiGet("/test")).rejects.toMatchObject({
      status: 401,
      body: "nope",
    });
  });
});
