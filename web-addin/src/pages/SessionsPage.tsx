import { useEffect, useState } from "react";
import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { EmptyState } from "../ui/composites/EmptyState";
import { apiGet, ApiError } from "../lib/api";

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

export function SessionsPage() {
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

  return (
    <Container size="lg" className="py-8">
      <div className="space-y-2 mb-6">
        <Caption>recent · capped at 50 in v2.0</Caption>
        <Heading level={1}>sessions</Heading>
        <Text className="text-addin-fg-muted">
          conversation history. session detail + replay arrives in v2.1.
        </Text>
      </div>

      {error && (
        <Card className="border-addin-danger text-addin-danger">{error}</Card>
      )}
      {!sessions && !error && (
        <div className="flex items-center gap-2 text-addin-fg-muted">
          <Spinner /> <span className="font-mono text-sm">loading…</span>
        </div>
      )}
      {sessions && sessions.length === 0 && (
        <EmptyState message="no sessions yet — start one with `addin` from the terminal." />
      )}
      {sessions && sessions.length > 0 && (
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
      )}
    </Container>
  );
}
