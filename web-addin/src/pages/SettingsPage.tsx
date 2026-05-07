import { useEffect, useState } from "react";
import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { apiGet, ApiError } from "../lib/api";

type ConfigPayload = Record<string, unknown>;

export function SettingsPage() {
  const [data, setData] = useState<ConfigPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<ConfigPayload>("/config")
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : String(e));
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <Container size="lg" className="py-8">
      <div className="space-y-2 mb-6">
        <Caption>configuration · read-only in v2.0</Caption>
        <Heading level={1}>settings</Heading>
        <Text className="text-addin-fg-muted">
          live view of <code className="bg-addin-bg-elev px-1 border border-addin-line">~/.addin/config.yaml</code>.
          editing arrives in v2.1.
        </Text>
      </div>

      {error && (
        <Card className="border-addin-danger text-addin-danger">{error}</Card>
      )}
      {!data && !error && (
        <div className="flex items-center gap-2 text-addin-fg-muted">
          <Spinner /> <span className="font-mono text-sm">loading…</span>
        </div>
      )}
      {data && (
        <Card>
          <pre className="text-xs whitespace-pre-wrap break-words font-mono text-addin-fg">
            {JSON.stringify(data, null, 2)}
          </pre>
        </Card>
      )}
    </Container>
  );
}
