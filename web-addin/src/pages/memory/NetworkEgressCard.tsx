import { useApi } from "../../lib/useApi";
import { Caption } from "../../ui/typography/Caption";
import { Text } from "../../ui/typography/Text";
import { Card } from "../../ui/primitives/Card";
import { Spinner } from "../../ui/primitives/Spinner";
import { Heading } from "../../ui/typography/Heading";

type NetworkEgressPayload = {
  distinct_hosts: number;
  hosts: { host: string; count: number }[];
};

export function NetworkEgressCard() {
  const { data, error, loading } = useApi<NetworkEgressPayload>("/addin/network-egress");

  return (
    <Card data-testid="network-egress-card">
      <Caption>network egress (24h)</Caption>
      {error && <Text className="text-addin-fg-muted">unavailable</Text>}
      {!error && loading && <Spinner />}
      {!error && !loading && data !== null && (
        <>
          <Heading level={2}>{data.distinct_hosts}</Heading>
          <Text className="text-addin-fg-muted text-sm">distinct hosts</Text>
          {(data.hosts ?? []).length === 0 ? (
            <Text className="text-addin-fg-muted text-sm mt-2">
              no outbound traffic recorded.
            </Text>
          ) : (
            <ul className="mt-2 space-y-0.5 text-sm">
              {(data.hosts ?? []).slice(0, 5).map((h) => (
                <li key={h.host} className="flex justify-between">
                  <span>{h.host}</span>
                  <span className="text-addin-fg-muted">{h.count}</span>
                </li>
              ))}
            </ul>
          )}
          <Text className="text-addin-fg-muted text-xs mt-2">
            dashboard-server scope only — cli-only invocations bypass tracking.
          </Text>
        </>
      )}
    </Card>
  );
}
