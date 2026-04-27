import { describe, expect, test } from "vitest";
import {
  APP_SETTINGS_NAV_ITEMS,
  getFirstChildNavKey,
  getParentNavKey,
} from "../components/app-settings/navigation";

describe("app settings navigation", () => {
  test("keeps application, agent, and about as top-level sidebar items", () => {
    expect(APP_SETTINGS_NAV_ITEMS.map((item) => item.key)).toEqual([
      "application",
      "agents",
      "about",
    ]);
    expect(APP_SETTINGS_NAV_ITEMS.map((item) => item.labelKey)).toEqual([
      "appSettings.application",
      "appSettings.agent",
      "appSettings.about",
    ]);
  });

  test("shows settings subsections under expandable top-level items", () => {
    expect(
      APP_SETTINGS_NAV_ITEMS.map((item) => item.children?.map((child) => child.key) ?? []),
    ).toEqual([["general", "theme", "shortcuts"], ["claude", "codex"], []]);
  });

  test("maps top-level clicks to the parent overview page", () => {
    expect([
      getFirstChildNavKey("application"),
      getFirstChildNavKey("agents"),
      getFirstChildNavKey("about"),
    ]).toEqual(["application", "agents", "about"]);
  });

  test("maps parent overview and child pages back to their top-level item", () => {
    expect([
      getParentNavKey("application"),
      getParentNavKey("general"),
      getParentNavKey("agents"),
      getParentNavKey("claude"),
      getParentNavKey("codex"),
    ]).toEqual(["application", "application", "agents", "agents", "agents"]);
  });
});
