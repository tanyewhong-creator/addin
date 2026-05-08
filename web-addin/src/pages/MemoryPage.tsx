import { useEffect, useState } from "react";
import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { EmptyState } from "../ui/composites/EmptyState";
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

type AuditEvent = { ts: string; actor: string; action: string; target: string };

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

function LastActionCard() {
  const [event, setEvent] = useState<AuditEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/addin/audit?limit=1")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => !cancelled && setEvent(d.events?.[0] ?? null))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card data-testid="last-action-card">
      <Caption>last action audited</Caption>
      {error && <Text className="text-addin-fg-muted">unavailable</Text>}
      {!error && event === null && (
        <Text className="text-addin-fg-muted">no events yet</Text>
      )}
      {!error && event && (
        <>
          <Text>{`${event.actor}: ${event.action}`}</Text>
          <Text className="text-addin-fg-muted text-sm">{event.target}</Text>
          <Text className="text-addin-fg-muted text-sm">{event.ts}</Text>
        </>
      )}
    </Card>
  );
}

function NetworkEgressCard() {
  const [data, setData] = useState<null | {
    distinct_hosts: number;
    hosts: { host: string; count: number }[];
  }>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/addin/network-egress")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => { cancelled = true; };
  }, []);

  return (
    <Card data-testid="network-egress-card">
      <Caption>network egress (24h)</Caption>
      {error && <Text className="text-addin-fg-muted">unavailable</Text>}
      {!error && data === null && <Spinner />}
      {!error && data !== null && (
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

function AuditTab() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [actor, setActor] = useState<string>("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE * (page + 1)));
    if (actor) params.set("actor", actor);
    fetch(`/api/addin/audit?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (cancelled) return;
        setEvents(d.events ?? []);
        setTotal(d.total_seen ?? 0);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [actor, page]);

  if (error) {
    return <Text className="text-addin-fg-muted">audit log unavailable</Text>;
  }
  if (events === null) return <Spinner />;

  const slice = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm">filter actor:</label>
        <select
          aria-label="actor filter"
          value={actor}
          onChange={(e) => {
            setActor(e.target.value);
            setPage(0);
          }}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">all</option>
          <option value="user">user</option>
          <option value="addin">addin</option>
          <option value="external">external</option>
        </select>
        <Text className="text-addin-fg-muted text-sm">total seen: {total}</Text>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-addin-fg-muted">
            <th className="py-2">time</th>
            <th>actor</th>
            <th>action</th>
            <th>target</th>
          </tr>
        </thead>
        <tbody>
          {slice.map((e, i) => (
            <tr key={`${e.ts}-${i}`} className="border-t border-addin-border">
              <td className="py-1.5">{e.ts}</td>
              <td>{e.actor}</td>
              <td>{e.action}</td>
              <td>{e.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {slice.length === 0 && (
        <EmptyState message="no audit events yet" />
      )}
      <div className="flex gap-2">
        <button
          aria-label="previous page"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          ← prev
        </button>
        <button
          aria-label="next page"
          disabled={(page + 1) * PAGE_SIZE >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          next →
        </button>
      </div>
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
        <NetworkEgressCard />
        <LastActionCard />
      </div>
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
      {active === "audit" && <AuditTab />}
    </Container>
  );
}
