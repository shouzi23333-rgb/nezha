import type { AppSettingsNavItem, NavKey, SettingsPageKey } from "./types";

export const APP_SETTINGS_NAV_ITEMS: AppSettingsNavItem[] = [
  {
    key: "application",
    labelKey: "appSettings.application",
    children: [
      { key: "general", labelKey: "appSettings.general" },
      { key: "theme", labelKey: "appSettings.theme" },
      { key: "shortcuts", labelKey: "appSettings.shortcuts" },
    ],
  },
  {
    key: "agents",
    labelKey: "appSettings.agent",
    children: [
      { key: "claude", labelKey: "Claude Code" },
      { key: "codex", labelKey: "Codex" },
    ],
  },
  { key: "about", labelKey: "appSettings.about" },
];

export function getFirstChildNavKey(key: NavKey): SettingsPageKey {
  return key === "application" || key === "agents" ? key : "about";
}

export function getParentNavKey(pageKey: SettingsPageKey): NavKey {
  if (pageKey === "application" || pageKey === "agents" || pageKey === "about") {
    return pageKey;
  }
  const item = APP_SETTINGS_NAV_ITEMS.find((navItem) =>
    navItem.children?.some((child) => child.key === pageKey),
  );
  return item?.key ?? "about";
}

export function findNavLabelKey(pageKey: SettingsPageKey): string {
  for (const item of APP_SETTINGS_NAV_ITEMS) {
    if (item.key === pageKey) {
      return item.labelKey;
    }
    if (item.key === "about" && pageKey === "about") {
      return item.labelKey;
    }
    const child = item.children?.find((navChild) => navChild.key === pageKey);
    if (child) {
      return child.labelKey;
    }
  }
  return "appSettings.about";
}
