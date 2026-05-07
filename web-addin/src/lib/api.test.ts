import { describe, it, expect, vi } from "vitest";
import { apiGet, ApiError } from "./api";

describe("apiGet", () => {
  it("calls /api<path> and returns parsed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ x: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = await apiGet<{ x: number }>("/config");
    expect(fetchMock).toHaveBeenCalledWith("/api/config");
    expect(out).toEqual({ x: 1 });
    vi.unstubAllGlobals();
  });

  it("throws ApiError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("oops"),
    }));
    await expect(apiGet("/config")).rejects.toBeInstanceOf(ApiError);
    vi.unstubAllGlobals();
  });
});
