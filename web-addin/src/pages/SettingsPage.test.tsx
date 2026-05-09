import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../ui/primitives/Toast";
import { SettingsPage } from "./SettingsPage";

const fetchMock = vi.fn();

const SAMPLE_PROFILES = [
  {
    name: "default",
    path: "/home/user/.hermes/profiles/default",
    is_default: true,
    model: "claude-sonnet-4-5",
    provider: "anthropic",
    has_env: true,
    skill_count: 42,
  },
  {
    name: "work",
    path: "/home/user/.hermes/profiles/work",
    is_default: false,
    model: "claude-opus-4-5",
    provider: "anthropic",
    has_env: false,
    skill_count: 7,
  },
];

const SAMPLE_MODEL_INFO = {
  model: "claude-sonnet-4-5",
  provider: "anthropic",
  auto_context_length: 200000,
  config_context_length: 0,
  effective_context_length: 200000,
  capabilities: {
    supports_tools: true,
    supports_vision: true,
    supports_reasoning: false,
  },
};

function makeFetch(
  profiles: typeof SAMPLE_PROFILES,
  modelInfo: Record<string, unknown> = SAMPLE_MODEL_INFO,
) {
  return (url: string) => {
    if (url.endsWith("/api/profiles")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ profiles }),
      });
    }
    if (url.endsWith("/api/model/info")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(modelInfo),
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve("not found"),
    });
  };
}

function renderSettings() {
  return render(
    <ToastProvider>
      <SettingsPage />
    </ToastProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(makeFetch(SAMPLE_PROFILES));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsPage", () => {
  it("renders heading and 6 tab buttons", () => {
    renderSettings();
    expect(screen.getByRole("heading", { level: 1, name: "settings" })).toBeInTheDocument();
    const expectedTabs = ["config", "env", "models", "mcp", "profiles", "docs"];
    for (const tab of expectedTabs) {
      expect(screen.getByRole("button", { name: tab })).toBeInTheDocument();
    }
  });

  it("profiles tab loads and renders profile names", async () => {
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "profiles" }));
    await waitFor(() => {
      // "default" appears as both the profile name and as the pill — use getAllByText
      expect(screen.getAllByText("default").length).toBeGreaterThan(0);
      expect(screen.getByText("work")).toBeInTheDocument();
    });
  });

  it("profiles tab shows empty state when API returns []", async () => {
    fetchMock.mockImplementation(makeFetch([]));
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "profiles" }));
    await waitFor(() => {
      expect(screen.getByText("no profiles configured.")).toBeInTheDocument();
    });
  });

  it("profiles tab shows default pill on the default profile only", async () => {
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "profiles" }));
    await waitFor(() => {
      // Both the profile name "default" AND its pill render text "default".
      // The "work" profile should have no "default" text at all.
      // getAllByText("default") should return exactly 2 nodes:
      //   1) the name span of the "default" profile
      //   2) the "default" pill on that profile
      const defaultEls = screen.getAllByText("default");
      expect(defaultEls.length).toBe(2);
      // The "work" profile name should be present with no pill
      expect(screen.getByText("work")).toBeInTheDocument();
    });
  });

  // --- ModelsTab tests ---

  it("models tab loads and renders provider/model", async () => {
    fetchMock.mockImplementation(makeFetch(SAMPLE_PROFILES, SAMPLE_MODEL_INFO));
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "models" }));
    await waitFor(() => {
      expect(screen.getByText("anthropic/claude-sonnet-4-5")).toBeInTheDocument();
    });
  });

  it("models tab shows effective context length", async () => {
    fetchMock.mockImplementation(makeFetch(SAMPLE_PROFILES, SAMPLE_MODEL_INFO));
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "models" }));
    await waitFor(() => {
      // effective_context_length=200000 is rendered via toLocaleString() => "200,000"
      expect(screen.getByText(/200,000/)).toBeInTheDocument();
    });
  });

  it("models tab handles empty config gracefully", async () => {
    fetchMock.mockImplementation(
      makeFetch(SAMPLE_PROFILES, {
        model: "",
        provider: "",
        auto_context_length: 0,
        config_context_length: 0,
        effective_context_length: 0,
        capabilities: {},
      }),
    );
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "models" }));
    await waitFor(() => {
      expect(screen.getByText("(no model configured)")).toBeInTheDocument();
    });
  });

  // --- DocsTab tests ---

  it("docs tab renders 3 external links", async () => {
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "docs" }));

    const specLink = screen.getByRole("link", { name: /design spec/i });
    expect(specLink).toHaveAttribute(
      "href",
      "https://github.com/tanyewhong-creator/addin/blob/main/docs/superpowers/specs/2026-05-07-addin-2.0-design.md",
    );
    expect(specLink).toHaveAttribute("target", "_blank");

    const changelogLink = screen.getByRole("link", { name: /changelog/i });
    expect(changelogLink).toHaveAttribute(
      "href",
      "https://github.com/tanyewhong-creator/addin/blob/main/CHANGELOG-ADDIN.md",
    );
    expect(changelogLink).toHaveAttribute("target", "_blank");

    const marketingLink = screen.getByRole("link", { name: /marketing site/i });
    expect(marketingLink).toHaveAttribute("href", "https://addin.tanyewhong.com/");
    expect(marketingLink).toHaveAttribute("target", "_blank");
  });

  // --- PluginsTab tests ---

  const SAMPLE_PLUGINS = [
    {
      name: "example",
      label: "Example",
      description: "Example dashboard plugin — demonstrates the plugin SDK",
      icon: "Sparkles",
      version: "1.0.0",
      tab: { path: "/example", position: "after:skills" },
      slots: ["sessions:top"],
      entry: "dist/index.js",
      css: null,
      has_api: true,
      source: "bundled",
    },
    {
      name: "analytics",
      label: "Analytics",
      description: "Usage analytics for dashboard interactions",
      icon: "BarChart",
      version: "0.2.1",
      tab: null,
      slots: [],
      entry: "dist/analytics.js",
      css: null,
      has_api: false,
      source: "user",
    },
  ];

  function makeFetchWithPlugins(
    plugins: typeof SAMPLE_PLUGINS,
    profiles = SAMPLE_PROFILES,
    modelInfo: Record<string, unknown> = SAMPLE_MODEL_INFO,
  ) {
    return (url: string) => {
      if (url.endsWith("/api/dashboard/plugins")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(plugins),
        });
      }
      if (url.endsWith("/api/profiles")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ profiles }),
        });
      }
      if (url.endsWith("/api/model/info")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(modelInfo),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve("not found"),
      });
    };
  }

  it("mcp tab loads and renders plugin labels", async () => {
    fetchMock.mockImplementation(makeFetchWithPlugins(SAMPLE_PLUGINS));
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "mcp" }));
    await waitFor(() => {
      // getAllByText handles the case where label text also appears in description
      expect(screen.getAllByText("Example").length).toBeGreaterThan(0);
      expect(screen.getByText("Analytics")).toBeInTheDocument();
    });
  });

  it("mcp tab shows empty state when no plugins discovered", async () => {
    fetchMock.mockImplementation(makeFetchWithPlugins([]));
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "mcp" }));
    await waitFor(() => {
      expect(screen.getByText("no dashboard plugins discovered.")).toBeInTheDocument();
    });
  });

  it("mcp tab footer explains MCP allowlist deferral", async () => {
    fetchMock.mockImplementation(makeFetchWithPlugins(SAMPLE_PLUGINS));
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "mcp" }));
    await waitFor(() => {
      expect(screen.getByText(/mcp permission surfaces/)).toBeInTheDocument();
    });
  });

});
