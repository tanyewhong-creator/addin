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

type Skill = {
  name: string;
  description?: string;
  category?: string;
  enabled?: boolean;
};

type SkillsPayload = Skill[] | { skills: Skill[] };

function normalize(payload: SkillsPayload): Skill[] {
  return Array.isArray(payload) ? payload : payload.skills ?? [];
}

type RecentSkill = { name: string; modified: string };

type Nudge = {
  id: string;
  text: string;
  suggested_command?: string | null;
  state: string;
  created: string;
};

type EvolvePayload = {
  recent_skills: RecentSkill[];
  skills_dir: string;
  skills_dir_exists: boolean;
  curator_status: string;
  curator_last_run: string | null;
  pending_nudges: { count: number; items: Nudge[] };
};

const TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "installed", label: "installed" },
  { id: "hub", label: "hub" },
  { id: "evolve", label: "evolve" },
];

function formatTime(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function NudgeList({
  initial,
  onAction,
}: {
  initial: Nudge[];
  onAction: () => void;
}) {
  const [items, setItems] = useState<Nudge[]>(initial);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  // Sync local items whenever the parent passes a fresh array (e.g. after
  // a tick-driven refetch following capture/dismiss). Without this, server
  // state can diverge from the rendered list — see Phase 2b Task 10 review.
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  async function act(id: string, verb: "capture" | "dismiss") {
    setErrorById((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
    try {
      const r = await fetch(`/api/addin/nudges/${id}/${verb}`, { method: "POST" });
      if (!r.ok) {
        setErrorById((prev) => ({ ...prev, [id]: `couldn't ${verb} (HTTP ${r.status})` }));
        return;
      }
      setItems((prev) => prev.filter((n) => n.id !== id));
      onAction();
    } catch {
      setErrorById((prev) => ({ ...prev, [id]: `couldn't ${verb} — network error` }));
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState message="no pending nudges. addin will surface skill suggestions here as it learns from your sessions." />
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((n) => (
        <li key={n.id} className="border border-addin-border rounded p-3">
          <Text>{n.text}</Text>
          {n.suggested_command && (
            <Text className="text-addin-fg-muted text-sm font-mono mt-1">
              {n.suggested_command}
            </Text>
          )}
          <div className="flex gap-2 mt-2">
            <button
              className="px-3 py-1 border rounded text-sm"
              onClick={() => act(n.id, "capture")}
            >
              capture
            </button>
            <button
              className="px-3 py-1 border rounded text-sm"
              onClick={() => act(n.id, "dismiss")}
            >
              dismiss
            </button>
          </div>
          {errorById[n.id] && (
            <Text className="text-addin-danger text-xs mt-2">
              {errorById[n.id]}
            </Text>
          )}
        </li>
      ))}
    </ul>
  );
}

function InstalledTab() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<SkillsPayload>("/skills")
      .then((d) => !cancelled && setSkills(normalize(d)))
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Card className="border-addin-danger text-addin-danger">{error}</Card>
    );
  }
  if (!skills) {
    return (
      <div className="flex items-center gap-2 text-addin-fg-muted">
        <Spinner /> <span className="font-mono text-sm">loading…</span>
      </div>
    );
  }
  if (skills.length === 0) {
    return <EmptyState message="no skills installed yet." />;
  }

  return (
    <div className="space-y-2">
      {skills.map((s) => (
        <Card key={s.name} className="flex items-baseline gap-4">
          <span className="font-mono text-sm text-addin-fg flex-1 truncate">
            {s.name}
          </span>
          {s.description && (
            <span className="font-mono text-xs text-addin-fg-muted flex-[2] truncate">
              {s.description}
            </span>
          )}
          {s.category && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-addin-fg-muted border border-addin-line px-1">
              {s.category}
            </span>
          )}
        </Card>
      ))}
    </div>
  );
}

function HubTab() {
  return (
    <Card>
      <Heading level={3}>v2.b</Heading>
      <Text className="text-addin-fg-muted">
        skills hub integration ships in v2.b — browse and install community skills
        without leaving the dashboard.
      </Text>
      <Text className="text-addin-fg-muted text-xs font-mono mt-2">
        for now, see addinskills.io
      </Text>
    </Card>
  );
}

function EvolveTab() {
  const { data, error, refetch } = useApi<EvolvePayload>("/addin/skills/evolve");

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
    <div className="space-y-4">
      <Caption>
        agent evolution: skills the agent has learned, curator status, and pending
        nudges for review.
      </Caption>

      <div>
        <Caption>recently learned skills</Caption>
        {data.recent_skills.length === 0 ? (
          <EmptyState message="no skills installed yet." />
        ) : (
          <div className="space-y-1 mt-2">
            {data.recent_skills.map((s) => (
              <Card
                key={s.name}
                className="flex items-baseline gap-4 py-2"
              >
                <span className="font-mono text-sm text-addin-fg flex-1 truncate">
                  {s.name}
                </span>
                <span className="font-mono text-xs text-addin-fg-muted">
                  {formatTime(s.modified)}
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <Caption>curator status</Caption>
          <Heading level={3}>{data.curator_status}</Heading>
          <Text className="text-addin-fg-muted text-xs">
            last run: {formatTime(data.curator_last_run)}
          </Text>
          <Text className="text-addin-fg-muted text-xs mt-1">
            live curator state ships in v2.b — for now this reads filesystem
            timestamps from ~/.hermes/logs/curator/.
          </Text>
        </Card>
        <Card>
          <Caption>pending nudges</Caption>
          <NudgeList initial={data.pending_nudges.items} onAction={refetch} />
        </Card>
      </div>
    </div>
  );
}

export function SkillsPage() {
  const [active, setActive] = useState<string>("installed");

  return (
    <Container size="lg" className="py-8">
      <div className="space-y-2 mb-6">
        <Caption>procedural memory · hub · evolve</Caption>
        <Heading level={1}>skills</Heading>
        <Text className="text-addin-fg-muted">
          workflows the agent has learned or that you've installed.
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

      {active === "installed" && <InstalledTab />}
      {active === "hub" && <HubTab />}
      {active === "evolve" && <EvolveTab />}
    </Container>
  );
}
