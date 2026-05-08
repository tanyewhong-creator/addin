import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApi } from "./useApi";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useApi", () => {
  it("returns data and loading=false on successful fetch", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: 42 }),
    });

    const { result } = renderHook(() => useApi<{ value: number }>("/test/path"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ value: 42 });
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/test/path");
  });

  it("returns error and loading=false on fetch failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("internal server error"),
    });

    const { result } = renderHook(() => useApi<{ value: number }>("/test/error"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toContain("500");
  });

  it("refetch() re-runs the fetch and updates data", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: 2 }),
      });

    const { result } = renderHook(() => useApi<{ value: number }>("/test/refetch"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toEqual({ value: 1 });

    result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 2 });
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
