import { useState, useEffect } from "react";
import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";
import { Spinner } from "../ui/primitives/Spinner";
import { Button } from "../ui/primitives/Button";
import { Textarea } from "../ui/primitives/Textarea";
import { useToast } from "../ui/primitives/Toast";
import { apiGet, apiPut, ApiError } from "../lib/api";

const TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "config", label: "config" },
  { id: "env", label: "env" },
  { id: "models", label: "models" },
  { id: "mcp", label: "mcp" },
  { id: "profiles", label: "profiles" },
  { id: "docs", label: "docs" },
];

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
      {active !== "config" && active !== "env" && <StubTab label={active} />}
    </Container>
  );
}
