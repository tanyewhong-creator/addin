import { useEffect, useState } from "react";
import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { apiGet, ApiError } from "../lib/api";

const TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "overview", label: "overview" },
  { id: "privacy", label: "privacy" },
  { id: "audit", label: "audit log" },
];

type MemoryOverview = {
  count: number;
  user_entries: number;
  project_entries: number;
  last_modified: string | null;
  memories_dir: string;
  memories_dir_exists: boolean;
};

type DataResidency = {
  home_path: string;
  real_path: string;
  exists: boolean;
  is_symlink: boolean;
  size_bytes: number;
  encrypted: boolean;
  measured_path: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiGet<T>(path)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return { data, error };
}

function OverviewTab() {
  const { data, error } = useApi<MemoryOverview>("/addin/memory/overview");

  if (error) {
    return (
      <Card className="border-addin-danger text-addin-danger">{error}</Card>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-addin-fg-muted">
        <Spinner /> <span className="font-mono text-sm">loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Caption>declarative memory: facts the agent has learned about you and your projects.</Caption>
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Heading level={3}>{data.count}</Heading>
            <Caption>total entries</Caption>
          </div>
          <div>
            <Heading level={3}>{formatTime(data.last_modified)}</Heading>
            <Caption>last modified</Caption>
          </div>
          <div>
            <Heading level={3}>{data.user_entries}</Heading>
            <Caption>user (preferences)</Caption>
          </div>
          <div>
            <Heading level={3}>{data.project_entries}</Heading>
            <Caption>project (facts)</Caption>
          </div>
        </div>
      </Card>
      <Text className="text-addin-fg-muted text-xs font-mono">
        source: {data.memories_dir}
        {!data.memories_dir_exists && " (not yet created)"}
      </Text>
    </div>
  );
}

function PrivacyTab() {
  const mem = useApi<MemoryOverview>("/addin/memory/overview");
  const res = useApi<DataResidency>("/addin/data-residency");

  return (
    <div className="space-y-4">
      <Caption>
        inspectable autonomy: what addin knows about you, where it lives, and what it ships off-device.
      </Caption>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <Caption>memory entries</Caption>
          {mem.error ? (
            <Text className="text-addin-danger">{mem.error}</Text>
          ) : mem.data ? (
            <>
              <Heading level={3}>{mem.data.count}</Heading>
              <Text className="text-addin-fg-muted text-xs">
                {mem.data.user_entries} user · {mem.data.project_entries} project
              </Text>
            </>
          ) : (
            <Spinner />
          )}
        </Card>
        <Card>
          <Caption>data residency</Caption>
          {res.error ? (
            <Text className="text-addin-danger">{res.error}</Text>
          ) : res.data ? (
            <>
              <Heading level={3}>{formatBytes(res.data.size_bytes)}</Heading>
              <Text className="text-addin-fg-muted text-xs font-mono break-all">
                {res.data.home_path}
                {res.data.is_symlink && " → "}
                {res.data.is_symlink && res.data.real_path}
              </Text>
              <Text className="text-addin-fg-muted text-xs">
                encryption: {res.data.encrypted ? "on" : "off (local-only)"}
              </Text>
            </>
          ) : (
            <Spinner />
          )}
        </Card>
        <Card>
          <Caption>network egress</Caption>
          <Heading level={3}>—</Heading>
          <Text className="text-addin-fg-muted text-xs">
            ships in v2.b — egress tracking requires an addin-side HTTP-client hook.
          </Text>
        </Card>
        <Card>
          <Caption>last action audited</Caption>
          <Heading level={3}>—</Heading>
          <Text className="text-addin-fg-muted text-xs">
            ships in v2.b — audit logging requires a hook into upstream's tool dispatcher.
          </Text>
        </Card>
      </div>
    </div>
  );
}

function AuditLogTab() {
  return (
    <div className="space-y-3">
      <Caption>audit log</Caption>
      <Card>
        <Heading level={3}>v2.b</Heading>
        <Text className="text-addin-fg-muted">
          addin-side audit logging ships in v2.b. it requires a hook into upstream's
          tool dispatcher so every action — file read, network call, skill invocation — gets
          a structured entry.
        </Text>
        <Text className="text-addin-fg-muted text-xs font-mono mt-2">
          for now, see ~/.hermes/logs/ for raw upstream logs.
        </Text>
      </Card>
    </div>
  );
}

export function MemoryPage() {
  const [active, setActive] = useState<string>("overview");

  return (
    <Container size="lg" className="py-8">
      <div className="space-y-2 mb-6">
        <Caption>declarative memory · privacy · audit</Caption>
        <Heading level={1}>memory</Heading>
        <Text className="text-addin-fg-muted">
          what addin remembers, where it lives, and what it does with it.
        </Text>
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

      {active === "overview" && <OverviewTab />}
      {active === "privacy" && <PrivacyTab />}
      {active === "audit" && <AuditLogTab />}
    </Container>
  );
}
