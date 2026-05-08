import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryPage } from "./MemoryPage";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith("/api/addin/memory/overview")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 5,
            user_entries: 3,
            project_entries: 2,
            last_modified: "2026-05-08T12:00:00+00:00",
            memories_dir: "/home/test/.hermes/memories",
            memories_dir_exists: true,
          }),
      });
    }
    if (url.endsWith("/api/addin/data-residency")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            home_path: "~/.addin",
            real_path: "/home/test/.hermes",
            exists: true,
            is_symlink: true,
            size_bytes: 2048,
            encrypted: false,
            measured_path: "/home/test/.hermes",
          }),
      });
    }
    if (url.includes("/api/addin/audit")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            events: [
              {
                ts: "2026-05-08T12:00:00+00:00",
                actor: "addin",
                action: "skill.captured",
                target: "git-rebase",
              },
              {
                ts: "2026-05-08T11:50:00+00:00",
                actor: "user",
                action: "nudge.dismissed",
                target: "abc123",
              },
            ],
            total_seen: 2,
            limit: 50,
          }),
      });
    }
    if (url.endsWith("/api/addin/network-egress")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            window_hours: 24,
            distinct_hosts: 3,
            hosts: [
              { host: "api.openai.com", count: 12 },
              { host: "github.com", count: 5 },
              { host: "raw.githubusercontent.com", count: 1 },
            ],
          }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MemoryPage", () => {
  it("renders heading and 3 tab buttons", async () => {
    render(<MemoryPage />);
    expect(screen.getByRole("heading", { level: 1, name: "memory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "privacy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "audit log" })).toBeInTheDocument();
  });

  it("loads overview data on mount", async () => {
    render(<MemoryPage />);
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });
    expect(screen.getByText(/total entries/i)).toBeInTheDocument();
  });

  it("switches to privacy tab and renders 4 metric cards", async () => {
    render(<MemoryPage />);
    await userEvent.click(screen.getByRole("button", { name: "privacy" }));
    await waitFor(() => {
      expect(screen.getByText(/network egress/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/data residency/i)).toBeInTheDocument();
    expect(screen.getByText(/last action audited/i)).toBeInTheDocument();
    expect(screen.getAllByText(/memory entries/i).length).toBeGreaterThan(0);
  });

  it("audit tab shows live audit table", async () => {
    render(<MemoryPage />);
    await userEvent.click(screen.getByRole("button", { name: "audit log" }));
    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
    expect(screen.getByText(/filter actor/i)).toBeInTheDocument();
  });

  it("privacy tab last-action card shows the latest event summary", async () => {
    render(<MemoryPage />);
    await userEvent.click(screen.getByRole("button", { name: "privacy" }));
    await waitFor(() => {
      expect(screen.getByText(/skill\.captured/)).toBeInTheDocument();
    });
    expect(screen.getByText(/git-rebase/)).toBeInTheDocument();
  });

  it("audit log tab renders a real table with at least one row", async () => {
    render(<MemoryPage />);
    await userEvent.click(screen.getByRole("button", { name: "audit log" }));
    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/skill\.captured|nudge\.dismissed/).length).toBe(2);
  });
  it("privacy tab network-egress card shows distinct host count", async () => {
    render(<MemoryPage />);
    await userEvent.click(screen.getByRole("button", { name: "privacy" }));
    await waitFor(() => {
      expect(screen.getByTestId("network-egress-card")).toBeInTheDocument();
    });
    expect(screen.getByText("3")).toBeInTheDocument(); // distinct_hosts
    expect(screen.getByText(/api\.openai\.com/)).toBeInTheDocument();
  });
});
