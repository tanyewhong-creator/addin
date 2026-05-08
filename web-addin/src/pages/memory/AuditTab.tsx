import { useState } from "react";
import { useApi } from "../../lib/useApi";
import { Text } from "../../ui/typography/Text";
import { Spinner } from "../../ui/primitives/Spinner";
import { EmptyState } from "../../ui/composites/EmptyState";

type AuditEvent = { ts: string; actor: string; action: string; target: string };

export function AuditTab() {
  const [actor, setActor] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE * (page + 1)));
  if (actor) params.set("actor", actor);
  const { data, error, loading } = useApi<{
    events: AuditEvent[];
    total_seen: number;
  }>(`/addin/audit?${params.toString()}`);

  if (error) {
    return <Text className="text-addin-fg-muted">audit log unavailable</Text>;
  }
  if (loading || !data) return <Spinner />;

  const events = data.events ?? [];
  const total = data.total_seen ?? 0;
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
