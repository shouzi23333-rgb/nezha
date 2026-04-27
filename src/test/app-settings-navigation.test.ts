import { describe, expect, test } from "vitest";
import {
  APP_SETTINGS_NAV_ITEMS,
  getFirstChildNavKey,
} from "../components/app-settings/navigation";

describe("app settings navigation", () => {
  test("keeps application, agent settings, and about as top-level sidebar items", () => {
    expect(APP_SETTINGS_NAV_ITEMS.map((item) => item.key)).toEqual([
      "application",
      "agents",
      "about",
    ]);
    expect(APP_SETTINGS_NAV_ITEMS.map((item) => item.labelKey)).toEqual([
      "appSettings.application",
      "appSettings.agentSettings",
      "appSettings.about",
    ]);
  });

  test("shows settings subsections under expandable top-level items", () => {
    expect(APP_SETTINGS_NAV_ITEMS.map((item) => item.children?.map((child) => child.key) ?? [])).toEqual([
      ["general", "theme", "shortcuts"],
      ["agent-paths", "claude", "codex"],
      [],
    ]);
  });

  test("maps top-level items to their first child page when available", () => {
    expect([
      getFirstChildNavKey("application"),
      getFirstChildNavKey("agents"),
      getFirstChildNavKey("about"),
    ]).toEqual([
      "general",
      "agent-paths",
      "about",
    ]);
  });
});
