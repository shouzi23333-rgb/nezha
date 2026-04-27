import { useState } from "react";
import { ChevronDown, Info, Settings, UserCog, X } from "lucide-react";
import type { ThemeMode } from "../types";
import { useI18n } from "../i18n";
import s from "../styles";
import { AboutPanel } from "./app-settings/AboutPanel";
import { AgentSettingsPanel } from "./app-settings/AgentSettingsPanel";
import { ApplicationSettingsPanel } from "./app-settings/ApplicationSettingsPanel";
import {
  APP_SETTINGS_NAV_ITEMS,
  findNavLabelKey,
  getFirstChildNavKey,
  getParentNavKey,
} from "./app-settings/navigation";
import type { NavKey, SettingsPageKey } from "./app-settings/types";

export function AppSettingsDialog({
  onClose,
  themeMode,
  systemPrefersDark,
  onThemeModeChange,
}: {
  onClose: () => void;
  themeMode: ThemeMode;
  systemPrefersDark: boolean;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const { t } = useI18n();
  const [activePage, setActivePage] = useState<SettingsPageKey>("application");
  const [expandedNav, setExpandedNav] = useState<Record<NavKey, boolean>>({
    application: false,
    agents: false,
    about: false,
  });

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const activeNav = getParentNavKey(activePage);
  const activeLabel = t(findNavLabelKey(activePage));

  function renderNavIcon(key: NavKey, size: number, color?: string) {
    if (key === "agents") {
      return <UserCog size={size} strokeWidth={1.8} color={color} />;
    }
    if (key === "about") {
      return <Info size={size} strokeWidth={1.8} color={color} />;
    }
    return <Settings size={size} strokeWidth={1.8} color={color} />;
  }

  function handleTopLevelClick(key: NavKey) {
    setActivePage(getFirstChildNavKey(key));
    setExpandedNav((prev) => ({
      ...prev,
      [key]: true,
    }));
  }

  function handleChildClick(key: SettingsPageKey) {
    setActivePage(key);
    setExpandedNav((prev) => ({
      ...prev,
      [getParentNavKey(key)]: true,
    }));
  }

  return (
    <div style={s.modalOverlay} onClick={handleOverlayClick}>
      <div style={s.modalBox}>
        <div style={s.settingsNav}>
          <div style={s.settingsNavTitle}>{t("appSettings.title")}</div>
          {APP_SETTINGS_NAV_ITEMS.map((item) => (
            <div key={item.key}>
              <button
                style={{
                  ...s.settingsNavItem,
                  background: activeNav === item.key ? "var(--bg-hover)" : "none",
                  color: activeNav === item.key ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: activeNav === item.key ? 600 : 500,
                }}
                onClick={() => handleTopLevelClick(item.key)}
              >
                {renderNavIcon(item.key, 14)}
                <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
                {item.children && (
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    style={{
                      transform: expandedNav[item.key] ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.12s ease",
                    }}
                  />
                )}
              </button>

              {item.children && expandedNav[item.key] && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    margin: "2px 0 6px 22px",
                  }}
                >
                  {item.children.map((child) => {
                    const active = activePage === child.key;
                    return (
                      <button
                        key={child.key}
                        style={{
                          ...s.settingsNavItem,
                          padding: "5px 8px",
                          fontSize: 12,
                          background: active ? "var(--bg-hover)" : "none",
                          color: active ? "var(--text-primary)" : "var(--text-secondary)",
                          fontWeight: active ? 600 : 500,
                        }}
                        onClick={() => handleChildClick(child.key)}
                      >
                        {t(child.labelKey)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={s.settingsContent}>
          <div style={s.settingsContentHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {renderNavIcon(activeNav, 16, "var(--text-secondary)")}
              <span style={s.settingsContentTitle}>{activeLabel}</span>
            </div>
            <button style={s.modalCloseBtn} onClick={onClose} title={t("common.close")}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {activePage === "application" ||
          activePage === "general" ||
          activePage === "theme" ||
          activePage === "shortcuts" ? (
            <ApplicationSettingsPanel
              key={activePage}
              activePage={activePage}
              themeMode={themeMode}
              systemPrefersDark={systemPrefersDark}
              onThemeModeChange={onThemeModeChange}
            />
          ) : activePage === "agents" || activePage === "claude" || activePage === "codex" ? (
            <AgentSettingsPanel key={activePage} activePage={activePage} />
          ) : activePage === "about" ? (
            <AboutPanel key="about" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
