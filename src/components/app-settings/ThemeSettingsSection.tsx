import { Check, ChevronDown } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import type { ThemeMode } from "../../types";
import { useI18n } from "../../i18n";
import {
  appSettingsHintStyle,
  appSettingsLabelStyle,
  appSettingsSectionStyle,
  appSettingsSectionTitleStyle,
} from "./sectionStyles";

interface ThemeSettingsSectionProps {
  themeMode: ThemeMode;
  systemPrefersDark: boolean;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export function ThemeSettingsSection({
  themeMode,
  systemPrefersDark,
  onThemeModeChange,
}: ThemeSettingsSectionProps) {
  const { t } = useI18n();
  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    {
      value: "system",
      label: t("theme.followingSystem", {
        mode: systemPrefersDark ? t("theme.dark") : t("theme.light"),
      }),
    },
    { value: "dark", label: t("theme.dark") },
    { value: "light", label: t("theme.light") },
  ];
  const selectedThemeLabel =
    themeOptions.find((option) => option.value === themeMode)?.label ?? themeMode;

  return (
    <section style={appSettingsSectionStyle}>
      <h3 style={appSettingsSectionTitleStyle}>{t("appSettings.theme")}</h3>
      <div>
        <label style={appSettingsLabelStyle}>{t("appSettings.theme")}</label>
        <Select.Root
          value={themeMode}
          onValueChange={(value) => onThemeModeChange(value as ThemeMode)}
        >
          <Select.Trigger
            aria-label={t("appSettings.theme")}
            style={{
              width: 220,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "7px 10px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-medium)",
              borderRadius: 7,
              color: "var(--text-primary)",
              fontSize: 12.5,
              fontFamily: "var(--font-ui)",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <Select.Value>{selectedThemeLabel}</Select.Value>
            <Select.Icon>
              <ChevronDown size={13} strokeWidth={2.2} color="var(--text-hint)" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              sideOffset={4}
              style={{
                minWidth: 220,
                background: "var(--bg-card)",
                border: "1px solid var(--border-medium)",
                borderRadius: 8,
                boxShadow: "var(--shadow-popover)",
                padding: 4,
                zIndex: 3000,
              }}
            >
              <Select.Viewport>
                {themeOptions.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 8px",
                      borderRadius: 5,
                      color: "var(--text-primary)",
                      fontSize: 12.5,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator style={{ marginLeft: "auto", display: "flex" }}>
                      <Check size={13} color="var(--accent)" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <div style={appSettingsHintStyle}>{t("theme.themeHint")}</div>
      </div>
    </section>
  );
}
