import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CronPage } from "./CronPage";

const fetchMock = vi.fn();

const SAMPLE_JOB = {
  id: "abc123def456",
  name: "daily digest",
  prompt: "summarize today's activity",
  schedule: { display: "every day at 09:00", kind: "cron", value: "0 9 * * *" },
  schedule_display: "every day at 09:00",
  enabled: true,
  state: "scheduled",
  paused_at: null,
  paused_reason: null,
  created_at: "2026-05-01T10:00:00+00:00",
  next_run_at: "2026-05-09T09:00:00+00:00",
  last_run_at: "2026-05-08T09:00:00+00:00",
  last_status: "ok",
  last_error: null,
  deliver: "local",
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith("/api/cron/jobs")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([SAMPLE_JOB]),
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

describe("CronPage", () => {
  it("renders heading and caption", () => {
    render(<CronPage />);
    expect(screen.getByRole("heading", { level: 1, name: "cron" })).toBeInTheDocument();
    expect(screen.getByText(/capped at 50/i)).toBeInTheDocument();
  });

  it("loads job list and renders job names", async () => {
    render(<CronPage />);
    await waitFor(() => {
      expect(screen.getByText("daily digest")).toBeInTheDocument();
    });
    expect(screen.getByText("every day at 09:00")).toBeInTheDocument();
  });

  it("shows empty state when API returns empty array", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/cron/jobs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve("not found"),
      });
    });
    render(<CronPage />);
    await waitFor(() => {
      expect(screen.getByText(/no cron jobs yet/i)).toBeInTheDocument();
    });
  });

  it("shows enabled status pill for enabled jobs", async () => {
    render(<CronPage />);
    await waitFor(() => {
      expect(screen.getByText("enabled")).toBeInTheDocument();
    });
  });

  it("shows disabled status pill for disabled jobs", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/cron/jobs")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([{ ...SAMPLE_JOB, enabled: false, state: "scheduled" }]),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve("not found"),
      });
    });
    render(<CronPage />);
    await waitFor(() => {
      expect(screen.getByText("disabled")).toBeInTheDocument();
    });
  });

  it("shows paused status pill when paused_at is set", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/cron/jobs")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                ...SAMPLE_JOB,
                enabled: true,
                state: "paused",
                paused_at: "2026-05-07T10:00:00+00:00",
              },
            ]),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve("not found"),
      });
    });
    render(<CronPage />);
    await waitFor(() => {
      expect(screen.getByText("paused")).toBeInTheDocument();
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
    render(<CronPage />);
    await waitFor(() => {
      expect(screen.getByText(/500/)).toBeInTheDocument();
    });
  });
});
