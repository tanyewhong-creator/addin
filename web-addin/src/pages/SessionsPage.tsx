import { useEffect, useState } from "react";
import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { EmptyState } from "../ui/composites/EmptyState";
import { apiGet, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Session = {
  id: string;
  source?: string;
  model?: string;
  title?: string;
  preview?: string;
  message_count?: number;
  started_at?: number; // epoch seconds
  ended_at?: number | null;
  last_active?: number;
  is_active?: boolean;
};

type SessionsPayload =
  | Session[]
  | { sessions: Session[]; total?: number; limit?: number; offset?: number };

type AuditEvent = {
  ts: string;
  actor: string;
  action: string;
  target: string;
  meta?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "history", label: "history" },
  { id: "insights", label: "insights" },
];

// ---------------------------------------------------------------------------
// Helpers (shared)
// ---------------------------------------------------------------------------

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function normalize(payload: SessionsPayload): Session[] {
  const arr = Array.isArray(payload) ? payload : payload.sessions ?? [];
  return arr.slice(0, 50);
}

function formatTimestamp(epochSeconds: number | undefined | null): string {
  if (!epochSeconds) return "";
  // upstream emits epoch seconds (float); JS Date wants ms.
  return DATE_FMT.format(new Date(epochSeconds * 1000));
}

// ---------------------------------------------------------------------------
// HistoryTab — preserves existing list-view logic exactly
// ---------------------------------------------------------------------------

function HistoryTab() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<SessionsPayload>("/sessions?limit=50")
      .then((d) => !cancelled && setSessions(normalize(d)))
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <Card className="border-addin-danger text-addin-danger">{error}</Card>;
  }
  if (!sessions) {
    return (
      <div className="flex items-center gap-2 text-addin-fg-muted">
        <Spinner /> <span className="font-mono text-sm">loading…</span>
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <EmptyState message="no sessions yet — start one with `addin` from the terminal." />
    );
  }
  return (
    <div className="space-y-1">
      {sessions.map((s) => {
        const ts = s.last_active || s.started_at;
        const tsFormatted = formatTimestamp(ts);
        const label = s.title || s.preview || s.id;
        return (
          <Card
            key={s.id}
            className="flex items-baseline gap-4 hover:bg-addin-bg-elev cursor-default"
          >
            <span className="font-mono text-xs text-addin-fg-faint w-24 shrink-0">
              {tsFormatted}
            </span>
            <span className="font-mono text-sm text-addin-fg truncate flex-1">
              {label}
            </span>
            {s.is_active && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-addin-fg border border-addin-line-strong px-1">
                live
              </span>
            )}
            {s.message_count != null && (
              <span className="font-mono text-xs text-addin-fg-faint shrink-0">
                {s.message_count} msgs
              </span>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InsightsTab — client-side aggregates from /api/addin/audit
//
// NOTE: The 10 000-event ceiling is generous for v2.0 audit log sizes.
// If the log grows past ~10 000 entries, this view's accuracy will skew
// (only the most-recent 10 000 are fetched). A server-side aggregator
// endpoint becomes worthwhile at that point — deferred past v2.0.
// ---------------------------------------------------------------------------

function InsightsTab() {
  const { data, error, loading } = useApi<{ events: AuditEvent[]; total_seen: number }>(
    "/addin/audit?limit=10000",
  );

  if (error) {
    return <Card className="border-addin-danger text-addin-danger">{error}</Card>;
  }
  if (loading || !data) return <Spinner />;

  const events = data.events ?? [];
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const recent7 = events.filter((e) => {
    const t = Date.parse(e.ts);
    return Number.isFinite(t) && t >= sevenDaysAgo;
  });

  const distinctHosts7 = new Set(
    recent7
      .filter((e) => e.action === "network.egress" && typeof e.target === "string")
      .map((e) => e.target),
  );

  const nudgeStats7 = {
    created: recent7.filter((e) => e.action === "nudge.created").length,
    captured: recent7.filter((e) => e.action === "nudge.captured").length,
    dismissed: recent7.filter((e) => e.action === "nudge.dismissed").length,
  };

  const activeDays30 = new Set(
    events
      .map((e) => Date.parse(e.ts))
      .filter((t) => Number.isFinite(t) && t >= thirtyDaysAgo)
      .map((t) => new Date(t).toISOString().slice(0, 10)),
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card data-testid="events-7d-card">
        <Caption>events (7d)</Caption>
        <Heading level={2}>{recent7.length}</Heading>
        <Text className="text-addin-fg-muted text-sm">
          across {events.length} total recorded
        </Text>
      </Card>

      <Card data-testid="hosts-7d-card">
        <Caption>distinct hosts (7d)</Caption>
        <Heading level={2}>{distinctHosts7.size}</Heading>
        <Text className="text-addin-fg-muted text-sm">
          from network.egress events
        </Text>
      </Card>

      <Card data-testid="nudges-7d-card">
        <Caption>nudges (7d)</Caption>
        <Heading level={2}>{nudgeStats7.created}</Heading>
        <Text className="text-addin-fg-muted text-sm">
          created · {nudgeStats7.captured} captured · {nudgeStats7.dismissed} dismissed
        </Text>
      </Card>

      <Card data-testid="active-days-card">
        <Caption>active days (30d)</Caption>
        <Heading level={2}>{activeDays30.size}</Heading>
        <Text className="text-addin-fg-muted text-sm">
          out of 30 — days with at least one audit event
        </Text>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function SessionsPage() {
  const [active, setActive] = useState<string>("history");

  return (
    <Container size="lg" className="py-8">
      <div className="space-y-2 mb-6">
        <Caption>conversation history + activity insights</Caption>
        <Heading level={1}>sessions</Heading>
      </div>

      <div className="flex gap-0 border-b border-addin-line mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={
              "px-3 py-2 text-xs font-mono border-b-2 -mb-px " +
              (active === t.id
                ? "text-addin-fg border-addin-line-strong font-medium"
                : "text-addin-fg-muted border-transparent hover:text-addin-fg")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "history" && <HistoryTab />}
      {active === "insights" && <InsightsTab />}
    </Container>
  );
}
