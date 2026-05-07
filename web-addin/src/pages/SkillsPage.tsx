import { useEffect, useState } from "react";
import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { EmptyState } from "../ui/composites/EmptyState";
import { apiGet, ApiError } from "../lib/api";

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

export function SkillsPage() {
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

  return (
    <Container size="lg" className="py-8">
      <div className="space-y-2 mb-6">
        <Caption>installed · v2.1 adds hub + evolve</Caption>
        <Heading level={1}>skills</Heading>
        <Text className="text-addin-fg-muted">
          procedural memory: workflows the agent has learned or that you've installed.
        </Text>
      </div>

      {error && (
        <Card className="border-addin-danger text-addin-danger">{error}</Card>
      )}
      {!skills && !error && (
        <div className="flex items-center gap-2 text-addin-fg-muted">
          <Spinner /> <span className="font-mono text-sm">loading…</span>
        </div>
      )}
      {skills && skills.length === 0 && (
        <EmptyState message="no skills installed yet." />
      )}
      {skills && skills.length > 0 && (
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
      )}
    </Container>
  );
}
