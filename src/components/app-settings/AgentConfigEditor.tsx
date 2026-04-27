import { type CSSProperties } from "react";
import { Check, Pencil } from "lucide-react";
import { useI18n } from "../../i18n";
import s from "../../styles";
import { appSettingsHintStyle, appSettingsLabelStyle } from "./sectionStyles";

type FileState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "loaded"; content: string };

export function AgentConfigEditor({
  resolvedFilePath,
  fileState,
  editing,
  saved,
  saving,
  dirty,
  onEdit,
  onCancel,
  onSave,
  onContentChange,
}: {
  resolvedFilePath: string;
  fileState: FileState;
  editing: boolean;
  saved: boolean;
  saving: boolean;
  dirty: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onContentChange: (content: string) => void;
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

  return (
    <div>
      <label style={appSettingsLabelStyle}>{t("appSettings.configFile")}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11.5,
            color: "var(--text-hint)",
            fontFamily: "var(--font-mono)",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-dim)",
            borderRadius: 6,
            padding: "6px 9px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {resolvedFilePath}
        </div>
        <button type="button" style={secondaryButtonStyle} onClick={onEdit}>
          <Pencil size={12} />
          {t("common.edit")}
        </button>
      </div>
      {fileState.status === "loading" && (
        <div style={appSettingsHintStyle}>{t("common.loading")}</div>
      )}
      {fileState.status === "missing" && (
        <div style={appSettingsHintStyle}>{t("appSettings.configFileMissing")}</div>
      )}
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

      {fileState.status === "loaded" && editing && (
        <>
          <textarea
            autoFocus
            style={{
              ...s.modalTextarea,
              width: "100%",
              minHeight: 260,
              marginTop: 10,
              resize: "vertical",
              boxSizing: "border-box",
              caretColor: "var(--text-primary)",
            }}
            value={fileState.content}
            onChange={(e) => onContentChange(e.target.value)}
            spellCheck={false}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" style={s.modalCancelBtn} onClick={onCancel}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              style={{ ...s.modalSaveBtn, opacity: saving || !dirty ? 0.5 : 1 }}
              onClick={onSave}
              disabled={saving || !dirty}
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
