import { type CSSProperties } from "react";
import { Check, RefreshCw } from "lucide-react";
import { useI18n } from "../../i18n";
import s from "../../styles";
import { appSettingsHintStyle, appSettingsLabelStyle } from "./sectionStyles";
import { getAgentExecutablePlaceholder } from "./shared";
import type { AgentKey } from "./types";

function getPathLabelKey(agentKey: AgentKey): string {
  return agentKey === "claude" ? "appSettings.claudePath" : "appSettings.codexPath";
}

function getPathHintKey(agentKey: AgentKey): string {
  return agentKey === "claude" ? "appSettings.claudePathHint" : "appSettings.codexPathHint";
}

export function AgentPathField({
  agentKey,
  value,
  loading,
  detecting,
  saving,
  saved,
  dirty,
  onChange,
  onDetect,
  onSave,
}: {
  agentKey: AgentKey;
  value: string;
  loading: boolean;
  detecting: boolean;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  onChange: (value: string) => void;
  onDetect: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const secondaryButtonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
    background: "none",
    border: "1px solid var(--border-medium)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--text-secondary)",
    cursor: "pointer",
  };
  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    background: "var(--bg-input)",
    border: "1px solid var(--border-medium)",
    borderRadius: 7,
    color: "var(--text-primary)",
    fontSize: 12.5,
    fontFamily: "var(--font-mono)",
    outline: "none",
    boxSizing: "border-box",
    opacity: loading ? 0.65 : 1,
  };

  return (
    <div>
      <label style={appSettingsLabelStyle}>{t(getPathLabelKey(agentKey))}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          style={inputStyle}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={getAgentExecutablePlaceholder(agentKey)}
          disabled={loading}
          spellCheck={false}
        />
        <button
          type="button"
          style={{
            ...secondaryButtonStyle,
            flexShrink: 0,
            cursor: detecting ? "default" : "pointer",
            opacity: detecting ? 0.6 : 1,
          }}
          onClick={onDetect}
          disabled={detecting}
        >
          <RefreshCw size={12} className={detecting ? "spin" : undefined} />
          {detecting ? t("appSettings.detecting") : t("appSettings.autoDetect")}
        </button>
        <button
          type="button"
          style={{
            ...s.modalSaveBtn,
            flexShrink: 0,
            opacity: saving || !dirty ? 0.5 : 1,
          }}
          onClick={onSave}
          disabled={loading || saving || !dirty}
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
      <div style={appSettingsHintStyle}>{t(getPathHintKey(agentKey))}</div>
      {saved && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 6,
            fontSize: 12,
            color: "var(--success)",
          }}
        >
          <Check size={12} /> {t("common.saved")}
        </div>
      )}
    </div>
  );
}
