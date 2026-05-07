import type { ComponentType } from "react";
import { ChatPage } from "./pages/ChatPage";
import { SkillsPage } from "./pages/SkillsPage";
import { MemoryPage } from "./pages/MemoryPage";
import { CronPage } from "./pages/CronPage";
import { SessionsPage } from "./pages/SessionsPage";
import { LogsPage } from "./pages/LogsPage";
import { SettingsPage } from "./pages/SettingsPage";

export type Route = {
  path: string;
  label: string;
  component: ComponentType;
};

export const TOP_LEVEL_ROUTES: ReadonlyArray<Route> = [
  { path: "/chat",     label: "chat",     component: ChatPage },
  { path: "/skills",   label: "skills",   component: SkillsPage },
  { path: "/memory",   label: "memory",   component: MemoryPage },
  { path: "/cron",     label: "cron",     component: CronPage },
  { path: "/sessions", label: "sessions", component: SessionsPage },
  { path: "/logs",     label: "logs",     component: LogsPage },
  { path: "/settings", label: "settings", component: SettingsPage },
];
