import type { ThemeMode } from "../../types";
import s from "../../styles";
import { LanguageSettingsSection } from "./LanguageSettingsSection";
import { ShortcutSettingsSection } from "./ShortcutSettingsSection";
import { ThemeSettingsSection } from "./ThemeSettingsSection";
import type { SettingsPageKey } from "./types";

interface ApplicationSettingsPanelProps {
  activePage: Extract<SettingsPageKey, "general" | "theme" | "shortcuts">;
  themeMode: ThemeMode;
  systemPrefersDark: boolean;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export function ApplicationSettingsPanel({
  activePage,
  themeMode,
  systemPrefersDark,
  onThemeModeChange,
}: ApplicationSettingsPanelProps) {
  return (
    <div
      style={{
        ...s.settingsBody,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: "20px",
      }}
    >
      {activePage === "general" ? (
        <LanguageSettingsSection />
      ) : activePage === "theme" ? (
        <ThemeSettingsSection
          themeMode={themeMode}
          systemPrefersDark={systemPrefersDark}
          onThemeModeChange={onThemeModeChange}
        />
      ) : (
        <ShortcutSettingsSection />
      )}
    </div>
  );
}
