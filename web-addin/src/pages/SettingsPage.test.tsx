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

function makeFetch(profiles: typeof SAMPLE_PROFILES) {
  return (url: string) => {
    if (url.endsWith("/api/profiles")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ profiles }),
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
});
