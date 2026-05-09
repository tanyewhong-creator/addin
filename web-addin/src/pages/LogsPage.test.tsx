import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogsPage } from "./LogsPage";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/api/logs") && url.includes("file=agent")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            file: "agent",
            lines: [
              "2026-05-08 09:00:01 INFO  [agent] session started",
              "2026-05-08 09:00:02 DEBUG [agent] tool called",
            ],
          }),
      });
    }
    if (url.includes("/api/logs") && url.includes("file=errors")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            file: "errors",
            lines: ["2026-05-08 09:01:00 ERROR [gateway] connection refused"],
          }),
      });
    }
    if (url.includes("/api/logs") && url.includes("file=gateway")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            file: "gateway",
            lines: ["2026-05-08 09:02:00 INFO  [gateway] request received"],
          }),
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve("not found"),
    });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LogsPage", () => {
  it("renders heading and file selector with three options", () => {
    render(<LogsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "logs" })).toBeInTheDocument();
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "agent" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "errors" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "gateway" })).toBeInTheDocument();
  });

  it("loads default agent log on mount and renders a sample line", async () => {
    render(<LogsPage />);
    await waitFor(() => {
      expect(screen.getByText(/session started/)).toBeInTheDocument();
    });
    // apiGet calls fetch(url) with no second arg — match only on URL content
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("file=agent"), expect.objectContaining({}));
  });

  it("changing the file selector re-fetches with ?file=errors", async () => {
    render(<LogsPage />);
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/session started/)).toBeInTheDocument();
    });
    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "errors");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("file=errors"), expect.objectContaining({}));
    });
    await waitFor(() => {
      expect(screen.getByText(/connection refused/)).toBeInTheDocument();
    });
  });

  it("shows empty state when log lines array is empty", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/logs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ file: "agent", lines: [] }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve("not found"),
      });
    });
    render(<LogsPage />);
    await waitFor(() => {
      expect(screen.getByText(/log empty/i)).toBeInTheDocument();
    });
  });

  it("shows error message when API call fails", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve("internal server error"),
      }),
    );
    render(<LogsPage />);
    await waitFor(() => {
      expect(screen.getByText(/500/)).toBeInTheDocument();
    });
  });

  it("renders search input and passes search param when non-empty", async () => {
    render(<LogsPage />);
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
    await userEvent.type(searchInput, "ERROR");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("search=ERROR"), expect.objectContaining({}));
    });
  });
});
