import type { SendShortcut } from "../../shortcuts";

export type NavKey = "application" | "agents" | "about";
export type SettingsPageKey =
  | "general"
  | "theme"
  | "shortcuts"
  | "agent-paths"
  | "claude"
  | "codex"
  | "about";

export interface AppSettings {
  claude_path: string;
  codex_path: string;
  send_shortcut: SendShortcut;
}

export interface AgentVersions {
  claude_version: string;
  codex_version: string;
}

export type AgentKey = "claude" | "codex";

export interface AppSettingsNavItem {
  key: NavKey;
  labelKey: string;
  children?: AppSettingsNavChild[];
}

export interface AppSettingsNavChild {
  key: SettingsPageKey;
  labelKey: string;
}

export const APP_SETTINGS_CHANGED_EVENT = "nezha:app-settings-changed";
