import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionsPage } from "./SessionsPage";

const fetchMock = vi.fn();

// Use timestamps relative to actual wall-clock now so the 7d / 30d window
// logic works without needing vi.useFakeTimers (which breaks waitFor).
// These are computed once at module-load time and are stable within a test run.
const now = Date.now();
const RECENT_TS = new Date(now - 26 * 60 * 60 * 1000).toISOString();  // 26h ago
const RECENT_TS2 = new Date(now - 50 * 60 * 60 * 1000).toISOString(); // 50h ago
const RECENT_TS3 = new Date(now - 74 * 60 * 60 * 1000).toISOString(); // 74h ago
const OLD_7D_TS = new Date(now - 11 * 24 * 60 * 60 * 1000).toISOString(); // 11 days ago

const SAMPLE_SESSIONS = [
  {
    id: "sess-abc",
    title: "Test Session Alpha",
    message_count: 10,
    started_at: 1746748800,
    last_active: 1746748800,
    is_active: false,
  },
  {
    id: "sess-def",
    title: "Test Session Beta",
    message_count: 5,
    started_at: 1746662400,
    last_active: 1746662400,
    is_active: true,
  },
];

// Default audit payload — 3 recent events (< 7d) + 1 old event (11d ago)
const DEFAULT_AUDIT_EVENTS = [
  { ts: RECENT_TS, actor: "addin", action: "nudge.created", target: "n1" },
  { ts: RECENT_TS2, actor: "addin", action: "nudge.captured", target: "n1" },
  { ts: RECENT_TS3, actor: "addin", action: "network.egress", target: "api.openai.com" },
  { ts: OLD_7D_TS, actor: "addin", action: "nudge.created", target: "n2" },
];

function makeFetchMock(auditEvents = DEFAULT_AUDIT_EVENTS) {
  return (url: string) => {
    if (url.includes("/api/addin/audit")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            events: auditEvents,
            total_seen: auditEvents.length,
          }),
      });
    }
    if (url.endsWith("/api/sessions") || url.includes("/api/sessions?")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ sessions: SAMPLE_SESSIONS, total: 2, limit: 50, offset: 0 }),
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve("not found"),
    });
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(makeFetchMock());
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SessionsPage", () => {
  it("renders heading and 2 tab buttons", () => {
    render(<SessionsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "sessions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "history" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "insights" })).toBeInTheDocument();
  });

  it("history tab loads sessions list on mount", async () => {
    render(<SessionsPage />);
    // history is the default tab — no click needed
    await waitFor(() => {
      expect(screen.getByText("Test Session Alpha")).toBeInTheDocument();
    });
    expect(screen.getByText("Test Session Beta")).toBeInTheDocument();
    // The active session badge should also render
    expect(screen.getByText("live")).toBeInTheDocument();
  });

  it("clicking insights tab loads audit events and shows metric cards", async () => {
    render(<SessionsPage />);
    await userEvent.click(screen.getByRole("button", { name: "insights" }));
    await waitFor(() => {
      expect(screen.getByTestId("events-7d-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("hosts-7d-card")).toBeInTheDocument();
    expect(screen.getByTestId("nudges-7d-card")).toBeInTheDocument();
    expect(screen.getByTestId("active-days-card")).toBeInTheDocument();
  });

  it("insights tab shows correct event count for last 7 days", async () => {
    // Default fixture: 3 recent (< 7d) + 1 old (11d ago) = 3 in 7d window, 4 total
    render(<SessionsPage />);
    await userEvent.click(screen.getByRole("button", { name: "insights" }));
    await waitFor(() => {
      expect(screen.getByTestId("events-7d-card")).toBeInTheDocument();
    });
    const card = screen.getByTestId("events-7d-card");
    // Heading shows "3" (recent7.length)
    expect(card).toHaveTextContent("3");
    // Sub-text shows total recorded = 4
    expect(card).toHaveTextContent("4");
  });

  it("insights tab counts distinct hosts from network.egress events in last 7d", async () => {
    const events = [
      { ts: RECENT_TS, actor: "addin", action: "network.egress", target: "api.openai.com" },
      { ts: RECENT_TS2, actor: "addin", action: "network.egress", target: "github.com" },
      { ts: RECENT_TS3, actor: "addin", action: "network.egress", target: "raw.githubusercontent.com" },
      // old egress — outside 7d window, should NOT count
      { ts: OLD_7D_TS, actor: "addin", action: "network.egress", target: "example.com" },
    ];
    fetchMock.mockImplementation(makeFetchMock(events));
    render(<SessionsPage />);
    await userEvent.click(screen.getByRole("button", { name: "insights" }));
    await waitFor(() => {
      expect(screen.getByTestId("hosts-7d-card")).toBeInTheDocument();
    });
    const card = screen.getByTestId("hosts-7d-card");
    expect(card).toHaveTextContent("3");
  });

  it("insights tab counts nudge events correctly", async () => {
    const events = [
      { ts: RECENT_TS, actor: "addin", action: "nudge.created", target: "n1" },
      { ts: RECENT_TS2, actor: "addin", action: "nudge.created", target: "n2" },
      { ts: RECENT_TS3, actor: "addin", action: "nudge.captured", target: "n1" },
      // no nudge.dismissed events
    ];
    fetchMock.mockImplementation(makeFetchMock(events));
    render(<SessionsPage />);
    await userEvent.click(screen.getByRole("button", { name: "insights" }));
    await waitFor(() => {
      expect(screen.getByTestId("nudges-7d-card")).toBeInTheDocument();
    });
    const card = screen.getByTestId("nudges-7d-card");
    // Heading shows 2 (nudge.created count)
    expect(card).toHaveTextContent("2");
    // Sub-text shows captured and dismissed counts
    expect(card).toHaveTextContent("1 captured");
    expect(card).toHaveTextContent("0 dismissed");
  });
});
