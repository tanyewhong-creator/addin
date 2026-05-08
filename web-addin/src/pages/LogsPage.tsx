import { useState } from "react";
import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { EmptyState } from "../ui/composites/EmptyState";
import { useApi } from "../lib/useApi";

type LogFile = "agent" | "errors" | "gateway";

type LogsPayload = {
  file: string;
  lines: string[];
};

const LOG_FILES: ReadonlyArray<{ value: LogFile; label: string }> = [
  { value: "agent", label: "agent" },
  { value: "errors", label: "errors" },
  { value: "gateway", label: "gateway" },
];

// Level= and component= filters are deferred to v2.1 — the upstream API
// supports them but the UI spec calls v2.0 "capped" on filter UI complexity.

export function LogsPage() {
  const [file, setFile] = useState<LogFile>("agent");
  const [search, setSearch] = useState("");

  const path =
    `/logs?file=${file}&lines=200` +
    (search ? `&search=${encodeURIComponent(search)}` : "");

  const { data, error, loading } = useApi<LogsPayload>(path);

  const lines = data?.lines ?? null;

  return (
    <Container size="lg" className="py-8">
      <div className="space-y-2 mb-6">
        <Caption>tail view · capped at 200 in v2.0</Caption>
        <Heading level={1}>logs</Heading>
        <Text className="text-addin-fg-muted">
          recent log lines. level / component filters arrive in v2.1.
        </Text>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={file}
          onChange={(e) => setFile(e.target.value as LogFile)}
          className="font-mono text-sm bg-addin-bg border border-addin-line px-2 py-1 text-addin-fg"
        >
          {LOG_FILES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search…"
          className="font-mono text-sm bg-addin-bg border border-addin-line px-2 py-1 text-addin-fg flex-1"
        />
      </div>

      {error && (
        <Card className="border-addin-danger text-addin-danger">{error}</Card>
      )}
      {loading && !error && (
        <div className="flex items-center gap-2 text-addin-fg-muted">
          <Spinner /> <span className="font-mono text-sm">loading…</span>
        </div>
      )}
      {lines && lines.length === 0 && (
        <EmptyState message="log empty" />
      )}
      {lines && lines.length > 0 && (
        <pre className="font-mono text-xs text-addin-fg-muted bg-addin-bg border border-addin-line p-4 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
          {lines.join("\n")}
        </pre>
      )}
    </Container>
  );
}
