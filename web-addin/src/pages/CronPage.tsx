import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { EmptyState } from "../ui/composites/EmptyState";
import { useApi } from "../lib/useApi";

// Fields from cron/jobs.py create_job / list_jobs
type CronJob = {
  id: string;
  name?: string;
  prompt?: string | null;
  schedule?: { display?: string; kind?: string; value?: string } | string;
  schedule_display?: string;
  enabled: boolean;
  state?: string;
  paused_at?: string | null;
  paused_reason?: string | null;
  created_at?: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  deliver?: string;
};

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return DATE_FMT.format(new Date(iso));
  } catch {
    return iso;
  }
}

function scheduleLabel(job: CronJob): string {
  if (job.schedule_display) return job.schedule_display;
  if (typeof job.schedule === "string") return job.schedule;
  if (job.schedule && typeof job.schedule === "object") {
    return job.schedule.display || job.schedule.value || "";
  }
  return "";
}

type StatusPill = "enabled" | "disabled" | "paused";

function statusPill(job: CronJob): StatusPill {
  if (job.paused_at || job.state === "paused") return "paused";
  if (!job.enabled) return "disabled";
  return "enabled";
}

const PILL_CLASSES: Record<StatusPill, string> = {
  enabled: "text-addin-fg border-addin-line",
  disabled: "text-addin-fg-muted border-addin-line",
  paused: "text-addin-fg-faint border-addin-line",
};

export function CronPage() {
  const { data, error, loading } = useApi<CronJob[]>("/cron/jobs");

  const jobs = data ? data.slice(0, 50) : null;

  return (
    <Container size="lg" className="py-8">
      <div className="space-y-2 mb-6">
        <Caption>scheduled · capped at 50 in v2.0</Caption>
        <Heading level={1}>cron</Heading>
        <Text className="text-addin-fg-muted">
          scheduled jobs. pause / resume / trigger arrive in v2.1.
        </Text>
      </div>

      {error && (
        <Card className="border-addin-danger text-addin-danger">{error}</Card>
      )}
      {loading && !error && (
        <div className="flex items-center gap-2 text-addin-fg-muted">
          <Spinner /> <span className="font-mono text-sm">loading…</span>
        </div>
      )}
      {jobs && jobs.length === 0 && (
        <EmptyState message="no cron jobs yet — create one with `addin cron add` from the terminal." />
      )}
      {jobs && jobs.length > 0 && (
        <div className="space-y-1">
          {jobs.map((job) => {
            const label = job.name || job.id;
            const sched = scheduleLabel(job);
            const pill = statusPill(job);
            const lastRun = formatTs(job.last_run_at);
            const nextRun = formatTs(job.next_run_at);

            return (
              <Card
                key={job.id}
                className="flex flex-col gap-1 hover:bg-addin-bg-elev cursor-default"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-addin-fg flex-1 truncate">
                    {label}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider border px-1 shrink-0 ${PILL_CLASSES[pill]}`}
                  >
                    {pill}
                  </span>
                </div>
                {sched && (
                  <span className="font-mono text-xs text-addin-fg-muted">
                    {sched}
                  </span>
                )}
                <div className="flex items-center gap-4 font-mono text-xs text-addin-fg-faint">
                  {lastRun && <span>last {lastRun}</span>}
                  {nextRun && <span>next {nextRun}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}
