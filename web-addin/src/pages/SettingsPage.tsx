import { useState, useEffect } from "react";
import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { Button } from "../ui/primitives/Button";
import { Textarea } from "../ui/primitives/Textarea";
import { EmptyState } from "../ui/composites/EmptyState";
import { useToast } from "../ui/primitives/Toast";
import { apiGet, apiPut, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";

const TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "config", label: "config" },
  { id: "env", label: "env" },
  { id: "models", label: "models" },
  { id: "mcp", label: "mcp" },
  { id: "profiles", label: "profiles" },
  { id: "docs", label: "docs" },
];

type Profile = {
  name: string;
  path: string;
  is_default: boolean;
  model?: string | null;
  provider?: string | null;
  has_env: boolean;
  skill_count: number;
};

type ModelCapabilities = {
  supports_tools?: boolean;
  supports_vision?: boolean;
  supports_reasoning?: boolean;
  context_window?: number;
  max_output_tokens?: number;
  model_family?: string;
};

type ModelInfo = {
  model: string;
  provider: string;
  auto_context_length: number;
  config_context_length: number;
  effective_context_length: number;
  capabilities: ModelCapabilities;
};
type Plugin = {
  name: string;
  label: string;
  description: string;
  icon: string;
  version: string;
  tab: { path: string; position: string } | null;
  slots: string[];
  entry: string;
  css: string | null;
  has_api: boolean;
  source: "bundled" | "user" | "project";
};


function ConfigTab() {
  const [json, setJson] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    apiGet<unknown>("/config")
      .then((d) => !cancelled && setJson(JSON.stringify(d, null, 2)))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : String(e)));
    return () => { cancelled = true; };
  }, []);

  async function onSave() {
    if (json === null) return;
    setSaving(true);
    setError(null);
    try {
      const parsed = JSON.parse(json);
      await apiPut("/config", parsed);
      toast("config saved", { intent: "success" });
    } catch (e: unknown) {
      const msg = e instanceof SyntaxError
        ? `invalid JSON: ${e.message}`
        : e instanceof ApiError
          ? `save failed: ${e.message}`
          : String(e);
      setError(msg);
      toast(msg, { intent: "danger" });
    } finally {
      setSaving(false);
    }
  }

  if (error && json === null) {
    return <Card className="border-addin-danger text-addin-danger">{error}</Card>;
  }
  if (json === null) {
    return (
      <div className="flex items-center gap-2 text-addin-fg-muted">
        <Spinner /> <span className="font-mono text-sm">loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Caption>JSON view of ~/.addin/config.yaml. YAML round-tripping ships in v2.1.</Caption>
      <Textarea
        rows={20}
        value={json}
        onChange={(e) => setJson(e.target.value)}
        className="font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button variant="primary" onClick={onSave} loading={saving} disabled={saving}>
          save
        </Button>
        {error && <span className="text-xs text-addin-danger self-center">{error}</span>}
      </div>
    </div>
  );
}

function EnvTab() {
  const [keys, setKeys] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Record<string, unknown>>("/env")
      .then((d) => !cancelled && setKeys(Object.keys(d)))
      .catch(() => !cancelled && setKeys([]));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-3">
      <Caption>read-only · editing arrives in v2.1</Caption>
      {keys === null ? (
        <div className="flex items-center gap-2 text-addin-fg-muted">
          <Spinner /> <span className="font-mono text-sm">loading…</span>
        </div>
      ) : keys.length === 0 ? (
        <Card><span className="text-addin-fg-muted text-sm">no env vars set</span></Card>
      ) : (
        <Card>
          <ul className="font-mono text-xs space-y-1">
            {keys.map((k) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="text-addin-fg-faint">••••••••</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ProfilesTab() {
  const { data, error, loading } = useApi<{ profiles: Profile[] }>("/profiles");

  if (error) {
    return <Card className="border-addin-danger text-addin-danger">{error}</Card>;
  }
  if (loading && !error) {
    return (
      <div className="flex items-center gap-2 text-addin-fg-muted">
        <Spinner /> <span className="font-mono text-sm">loading…</span>
      </div>
    );
  }

  const profiles = data?.profiles ?? [];

  if (profiles.length === 0) {
    return <EmptyState message="no profiles configured." />;
  }

  return (
    <div className="space-y-1">
      {profiles.map((p) => (
        <Card key={p.name} className="flex flex-col gap-1">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm text-addin-fg flex-1 truncate">{p.name}</span>
            {p.is_default && (
              <span className="font-mono text-[10px] uppercase tracking-wider border px-1 shrink-0 text-addin-fg border-addin-line">
                default
              </span>
            )}
          </div>
          {p.provider && p.model && (
            <span className="font-mono text-xs text-addin-fg-muted">
              {p.provider} / {p.model}
            </span>
          )}
          <div className="flex items-center gap-4 font-mono text-xs text-addin-fg-faint">
            <span>{p.skill_count} skills</span>
            {p.has_env && <span>has .env</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ModelsTab() {
  const { data, error, loading } = useApi<ModelInfo>("/model/info");

  if (error) {
    return <Card className="border-addin-danger text-addin-danger">{error}</Card>;
  }
  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-addin-fg-muted">
        <Spinner /> <span className="font-mono text-sm">loading…</span>
      </div>
    );
  }

  const model = data?.model ?? "";
  const provider = data?.provider ?? "";
  const effectiveCtx = data?.effective_context_length ?? 0;
  const configCtx = data?.config_context_length ?? 0;
  const contextSource = configCtx > 0 ? "override" : "auto-detected";
  const caps = data?.capabilities ?? {};

  const modelLabel = model
    ? provider
      ? `${provider}/${model}`
      : model
    : "(no model configured)";

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-1">
        <span className="font-mono text-sm text-addin-fg">{modelLabel}</span>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs">
          <span className="text-addin-fg-muted">context window</span>
          <span className="text-addin-fg">{effectiveCtx > 0 ? effectiveCtx.toLocaleString() : "—"}</span>

          <span className="text-addin-fg-muted">context source</span>
          <span className="text-addin-fg">{model ? contextSource : "—"}</span>

          {caps.supports_tools !== undefined && (
            <>
              <span className="text-addin-fg-muted">tools</span>
              <span className="text-addin-fg">{caps.supports_tools ? "yes" : "no"}</span>
            </>
          )}
          {caps.supports_vision !== undefined && (
            <>
              <span className="text-addin-fg-muted">vision</span>
              <span className="text-addin-fg">{caps.supports_vision ? "yes" : "no"}</span>
            </>
          )}
          {caps.supports_reasoning !== undefined && (
            <>
              <span className="text-addin-fg-muted">reasoning</span>
              <span className="text-addin-fg">{caps.supports_reasoning ? "yes" : "no"}</span>
            </>
          )}
        </div>
      </Card>

      <Text className="text-addin-fg-muted text-sm">
        picker arrives in v2.1 — for now, run `addin model` from the terminal.
      </Text>
    </div>
  );
}

function DocsTab() {
  const links = [
    {
      title: "Design spec",
      href: "https://github.com/tanyewhong-creator/addin/blob/main/docs/superpowers/specs/2026-05-07-addin-2.0-design.md",
      description: "The full addin 2.0 design specification.",
    },
    {
      title: "CHANGELOG",
      href: "https://github.com/tanyewhong-creator/addin/blob/main/CHANGELOG-ADDIN.md",
      description: "Release notes for every addin version.",
    },
    {
      title: "Marketing site",
      href: "https://addin.tanyewhong.com/",
      description: "The public addin landing page.",
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <ul className="space-y-4">
          {links.map((link) => (
            <li key={link.href} className="flex flex-col gap-0.5">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-addin-fg hover:underline"
              >
                {link.title}
              </a>
              <span className="font-mono text-[10px] text-addin-fg-faint break-all">{link.href}</span>
              <span className="text-xs text-addin-fg-muted">{link.description}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Text className="text-addin-fg-muted text-sm">
        in-dashboard markdown viewer ships in v2.1; for now docs live on github + the marketing site.
      </Text>
    </div>
  );
}

function PluginsTab() {
  const { data, error, loading } = useApi<Plugin[]>("/dashboard/plugins");

  if (error) {
    return <Card className="border-addin-danger text-addin-danger">{error}</Card>;
  }
  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-addin-fg-muted">
        <Spinner /> <span className="font-mono text-sm">loading…</span>
      </div>
    );
  }

  const plugins = data ?? [];

  return (
    <div className="space-y-4">
      {plugins.length === 0 ? (
        <EmptyState message="no dashboard plugins discovered." />
      ) : (
        <div className="space-y-1">
          {plugins.map((p) => (
            <Card key={p.name} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-addin-fg font-medium">{p.label}</span>
                <span className="font-mono text-xs text-addin-fg-muted">· {p.name}</span>
              </div>
              <span className="text-xs text-addin-fg-muted">{p.description}</span>
              <div className="flex items-center gap-2 font-mono text-xs text-addin-fg-faint flex-wrap">
                <span className="border border-addin-line px-1">{p.source}</span>
                <span>{p.version}</span>
                {p.has_api && (
                  <span className="border border-addin-line px-1">api</span>
                )}
              </div>
              {p.tab?.path && (
                <span className="font-mono text-xs text-addin-fg-faint">
                  mounts at <code>{p.tab.path}</code>
                </span>
              )}
            </Card>
          ))}
        </div>
      )}
      <Text className="text-addin-fg-muted text-xs mt-6">
        this tab lists the dashboard plugins discovered under
        ~/.hermes/plugins/ and the bundled set. mcp server allowlists and
        per-server scope visibility are tracked separately as a v2.1+ item
        per spec §3.7 (mcp permission surfaces).
      </Text>
    </div>
  );
}


// Safety-net for future TABS additions that land without an immediate handler.
// Intentionally kept unused — linting warnings for this function are expected.
function StubTab({ label }: { label: string }) {
  return (
    <Card>
      <Text className="text-addin-fg-muted text-sm">
        {label} configuration ships in v2.1 — for now, edit ~/.addin/config.yaml or use the CLI.
      </Text>
    </Card>
  );
}

export function SettingsPage() {
  const [active, setActive] = useState<string>("config");

  return (
    <Container size="lg" className="py-8">
      <div className="space-y-2 mb-6">
        <Caption>configuration</Caption>
        <Heading level={1}>settings</Heading>
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

      {active === "config" && <ConfigTab />}
      {active === "env" && <EnvTab />}
      {active === "profiles" && <ProfilesTab />}
      {active === "models" && <ModelsTab />}
      {active === "docs" && <DocsTab />}
      {active === "mcp" && <PluginsTab />}
    </Container>
  );
}
