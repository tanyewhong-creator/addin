import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkillsPage } from "./SkillsPage";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith("/api/skills")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { name: "alpha", description: "first skill", category: "test" },
          ]),
      });
    }
    if (url.endsWith("/api/addin/skills/evolve")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            recent_skills: [
              { name: "alpha", modified: "2026-05-08T12:00:00+00:00" },
            ],
            skills_dir: "/home/test/.hermes/skills",
            skills_dir_exists: true,
            curator_status: "idle",
            curator_last_run: null,
            pending_nudges: {
              count: 1,
              items: [
                {
                  id: "abc12345",
                  text: "you ran git rebase three times today — capture?",
                  suggested_command: "git rebase -i HEAD~5",
                  state: "pending",
                  created: "2026-05-08T11:55:00+00:00",
                },
              ],
            },
          }),
      });
    }
    if (url.match(/\/api\/addin\/nudges\/[^/]+\/(capture|dismiss)$/)) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ pending_nudges: { count: 0, items: [] } }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SkillsPage", () => {
  it("renders heading and 3 tab buttons", () => {
    render(<SkillsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "skills" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "installed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "hub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "evolve" })).toBeInTheDocument();
  });

  it("loads installed skills from /api/skills on mount", async () => {
    render(<SkillsPage />);
    await waitFor(() => {
      expect(screen.getByText("alpha")).toBeInTheDocument();
    });
    expect(screen.getByText("first skill")).toBeInTheDocument();
  });

  it("hub tab shows v2.b deferral", async () => {
    render(<SkillsPage />);
    await userEvent.click(screen.getByRole("button", { name: "hub" }));
    expect(await screen.findByText(/addinskills\.io/i)).toBeInTheDocument();
  });

  it("evolve tab loads curator status and pending nudges list", async () => {
    render(<SkillsPage />);
    await userEvent.click(screen.getByRole("button", { name: "evolve" }));
    await waitFor(() => {
      expect(screen.getByText("idle")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/curator status/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/git rebase three times/)).toBeInTheDocument();
  });

  it("evolve tab renders pending nudge with capture and dismiss buttons", async () => {
    render(<SkillsPage />);
    await userEvent.click(screen.getByRole("button", { name: "evolve" }));
    await waitFor(() => {
      expect(screen.getByText(/git rebase three times/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /capture/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });

  it("clicking capture POSTs to capture endpoint and removes the nudge", async () => {
    // After the capture POST, the refetch returns empty nudges so the list stays empty.
    let evolveCallCount = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/skills") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: "alpha", description: "first skill", category: "test" }]),
        });
      }
      if (url.endsWith("/api/addin/skills/evolve")) {
        evolveCallCount += 1;
        const items = evolveCallCount === 1
          ? [{ id: "abc12345", text: "you ran git rebase three times today — capture?", suggested_command: "git rebase -i HEAD~5", state: "pending", created: "2026-05-08T11:55:00+00:00" }]
          : [];
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            recent_skills: [{ name: "alpha", modified: "2026-05-08T12:00:00+00:00" }],
            skills_dir: "/home/test/.hermes/skills",
            skills_dir_exists: true,
            curator_status: "idle",
            curator_last_run: null,
            pending_nudges: { count: items.length, items },
          }),
        });
      }
      if (url.match(/\/api\/addin\/nudges\/[^/]+\/(capture|dismiss)$/)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ pending_nudges: { count: 0, items: [] } }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") });
    });

    render(<SkillsPage />);
    await userEvent.click(screen.getByRole("button", { name: "evolve" }));
    await waitFor(() => {
      expect(screen.getByText(/git rebase three times/)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /capture/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/addin/nudges/abc12345/capture",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByText(/git rebase three times/)).not.toBeInTheDocument();
    });
  });

  it("clicking dismiss POSTs to dismiss endpoint", async () => {
    render(<SkillsPage />);
    await userEvent.click(screen.getByRole("button", { name: "evolve" }));
    await userEvent.click(await screen.findByRole("button", { name: /dismiss/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/addin/nudges/abc12345/dismiss",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("evolve tab reflects new nudges that appear server-side after a capture", async () => {
    // First fetch returns one nudge; second fetch (after capture) returns a different one.
    let evolveCallCount = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/skills") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: "alpha", description: "first skill", category: "test" }]),
        });
      }
      if (url.endsWith("/api/addin/skills/evolve")) {
        evolveCallCount += 1;
        const payload = evolveCallCount === 1
          ? {
              recent_skills: [],
              skills_dir: "/",
              skills_dir_exists: true,
              curator_status: "idle",
              curator_last_run: null,
              pending_nudges: {
                count: 1,
                items: [{ id: "first", text: "first nudge", suggested_command: null, state: "pending", created: "2026-05-08T11:55:00+00:00" }],
              },
            }
          : {
              recent_skills: [],
              skills_dir: "/",
              skills_dir_exists: true,
              curator_status: "idle",
              curator_last_run: null,
              pending_nudges: {
                count: 1,
                items: [{ id: "second", text: "second nudge appeared after capture", suggested_command: null, state: "pending", created: "2026-05-08T11:56:00+00:00" }],
              },
            };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
      }
      if (url.match(/\/api\/addin\/nudges\/[^/]+\/(capture|dismiss)$/)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ pending_nudges: { count: 0, items: [] } }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") });
    });

    render(<SkillsPage />);
    await userEvent.click(screen.getByRole("button", { name: "evolve" }));
    await waitFor(() => {
      expect(screen.getByText("first nudge")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /capture/i }));
    await waitFor(() => {
      expect(screen.getByText("second nudge appeared after capture")).toBeInTheDocument();
    });
  });
});
