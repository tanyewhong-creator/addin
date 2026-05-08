import { useApi } from "../../lib/useApi";
import { Caption } from "../../ui/typography/Caption";
import { Text } from "../../ui/typography/Text";
import { Card } from "../../ui/primitives/Card";
import { Spinner } from "../../ui/primitives/Spinner";

type AuditEvent = { ts: string; actor: string; action: string; target: string };

export function LastActionCard() {
  const { data, error, loading } = useApi<{ events: AuditEvent[] }>("/addin/audit?limit=1");
  const event = data?.events?.[0] ?? null;

  return (
    <Card data-testid="last-action-card">
      <Caption>last action audited</Caption>
      {error && <Text className="text-addin-fg-muted">unavailable</Text>}
      {!error && loading && <Spinner />}
      {!error && !loading && event === null && (
        <Text className="text-addin-fg-muted">no events yet</Text>
      )}
      {!error && !loading && event && (
        <>
          <Text>{`${event.actor}: ${event.action}`}</Text>
          <Text className="text-addin-fg-muted text-sm">{event.target}</Text>
          <Text className="text-addin-fg-muted text-sm">{event.ts}</Text>
        </>
      )}
    </Card>
  );
}
