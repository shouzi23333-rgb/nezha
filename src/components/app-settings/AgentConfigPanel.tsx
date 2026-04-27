import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { DEFAULT_SEND_SHORTCUT, normalizeSendShortcut } from "../../shortcuts";
import { useI18n } from "../../i18n";
import s from "../../styles";
import {
  appSettingsHintStyle,
  appSettingsLabelStyle,
  appSettingsSectionStyle,
  appSettingsSectionTitleStyle,
} from "./sectionStyles";
import { AgentConfigEditor } from "./AgentConfigEditor";
import { AgentPathField } from "./AgentPathField";
import {
  APP_SETTINGS_CHANGED_EVENT,
  type AgentKey,
  type AgentVersions,
  type AppSettings,
} from "./types";

type FileState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "loaded"; content: string };

function getAgentPath(settings: AppSettings, agentKey: AgentKey): string {
  return agentKey === "claude" ? settings.claude_path : settings.codex_path;
}

export function AgentConfigPanel({
  agentKey,
  filePath,
  title,
  embedded = false,
}: {
  agentKey: AgentKey;
  filePath: string;
  title: string;
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const [resolvedFilePath, setResolvedFilePath] = useState(filePath);
  const [fileState, setFileState] = useState<FileState>({ status: "loading" });
  const [original, setOriginal] = useState("");
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    claude_path: "",
    codex_path: "",
    send_shortcut: DEFAULT_SEND_SHORTCUT,
  });
  const [originalPath, setOriginalPath] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [detectingPath, setDetectingPath] = useState(false);
  const [savingPath, setSavingPath] = useState(false);
  const [pathSaved, setPathSaved] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [version, setVersion] = useState("");
  const [refreshingVersion, setRefreshingVersion] = useState(false);
  const versionRequestIdRef = useRef(0);

  useEffect(() => {
    setResolvedFilePath(filePath);
    invoke<string>("get_agent_config_file_path", { agent: agentKey })
      .then((resolvedPath) => setResolvedFilePath(resolvedPath))
      .catch(() => setResolvedFilePath(filePath));
  }, [agentKey, filePath]);

  useEffect(() => {
    setFileState({ status: "loading" });
    setEditing(false);
    setError(null);
    setConfigSaved(false);
    invoke<string | null>("read_agent_config_file", { agent: agentKey })
      .then((content) => {
        if (content === null) {
          setFileState({ status: "missing" });
          setOriginal("");
        } else {
          setFileState({ status: "loaded", content });
          setOriginal(content);
        }
      })
      .catch((e) => setError(String(e)));
  }, [agentKey]);

  useEffect(() => {
    setLoadingSettings(true);
    invoke<AppSettings>("load_app_settings")
      .then((loadedSettings) => {
        const normalized = {
          ...loadedSettings,
          send_shortcut: normalizeSendShortcut(loadedSettings.send_shortcut),
        };
        setSettings(normalized);
        setOriginalPath(getAgentPath(normalized, agentKey));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingSettings(false));
  }, [agentKey]);

  const loadVersion = useCallback(async () => {
    const requestId = versionRequestIdRef.current + 1;
    versionRequestIdRef.current = requestId;
    setRefreshingVersion(true);
    try {
      const latest = await invoke<AppSettings>("load_app_settings");
      const detected = await invoke<AgentVersions>("detect_agent_versions_for_settings", {
        settings: latest,
      });
      if (versionRequestIdRef.current === requestId) {
        setVersion(agentKey === "claude" ? detected.claude_version : detected.codex_version);
      }
    } catch (e) {
      if (versionRequestIdRef.current === requestId) {
        setError(String(e));
      }
    } finally {
      if (versionRequestIdRef.current === requestId) {
        setRefreshingVersion(false);
      }
    }
  }, [agentKey]);

  useEffect(() => {
    void loadVersion();
  }, [loadVersion]);

  async function handleDetectPath() {
    setDetectingPath(true);
    setError(null);
    try {
      const detected = await invoke<AppSettings>("detect_agent_paths");
      const nextPath = getAgentPath(detected, agentKey);
      setSettings((prev) => ({
        ...prev,
        claude_path: agentKey === "claude" ? nextPath : prev.claude_path,
        codex_path: agentKey === "codex" ? nextPath : prev.codex_path,
      }));
    } catch (e) {
      setError(String(e));
    } finally {
      setDetectingPath(false);
    }
  }

  async function handleSavePath() {
    setSavingPath(true);
    setError(null);
    setPathSaved(false);
    try {
      const latest = await invoke<AppSettings>("load_app_settings");
      const nextSettings = {
        ...latest,
        send_shortcut: normalizeSendShortcut(latest.send_shortcut),
        claude_path: agentKey === "claude" ? settings.claude_path : latest.claude_path,
        codex_path: agentKey === "codex" ? settings.codex_path : latest.codex_path,
      };
      await invoke("save_app_settings", { settings: nextSettings });
      setSettings(nextSettings);
      setOriginalPath(getAgentPath(nextSettings, agentKey));
      window.dispatchEvent(new Event(APP_SETTINGS_CHANGED_EVENT));
      setPathSaved(true);
      setTimeout(() => setPathSaved(false), 2000);
      void loadVersion();
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingPath(false);
    }
  }

  async function handleSaveConfig() {
    if (fileState.status !== "loaded") return;
    setSavingConfig(true);
    setError(null);
    setConfigSaved(false);
    try {
      await invoke("write_agent_config_file", { agent: agentKey, content: fileState.content });
      setOriginal(fileState.content);
      setConfigSaved(true);
      setEditing(false);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingConfig(false);
    }
  }

  function handleCancelConfig() {
    setFileState({ status: "loaded", content: original });
    setEditing(false);
  }

  function updateAgentPath(value: string) {
    setSettings((prev) => ({
      ...prev,
      claude_path: agentKey === "claude" ? value : prev.claude_path,
      codex_path: agentKey === "codex" ? value : prev.codex_path,
    }));
  }

  function startEditingConfig() {
    if (fileState.status === "missing") {
      setFileState({ status: "loaded", content: "" });
      setOriginal("");
    }
    setEditing(true);
  }

  const currentPath = getAgentPath(settings, agentKey);
  const pathDirty = currentPath !== originalPath;
  const configDirty = fileState.status === "loaded" && fileState.content !== original;

  return (
    <section
      style={{
        ...(embedded ? appSettingsSectionStyle : { ...s.settingsBody, padding: "20px" }),
      }}
    >
      <h3 style={appSettingsSectionTitleStyle}>{title}</h3>
      {error && <div style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}

      <AgentPathField
        agentKey={agentKey}
        value={currentPath}
        loading={loadingSettings}
        detecting={detectingPath}
        saving={savingPath}
        saved={pathSaved}
        dirty={pathDirty}
        onChange={updateAgentPath}
        onDetect={handleDetectPath}
        onSave={handleSavePath}
      />

      <div>
        <label style={appSettingsLabelStyle}>{t("appSettings.installedVersions")}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>
            {version || t("common.notDetected")}
          </span>
          <button
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              background: "none",
              border: "1px solid var(--border-medium)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--text-secondary)",
              cursor: refreshingVersion ? "default" : "pointer",
              opacity: refreshingVersion ? 0.6 : 1,
            }}
            onClick={() => loadVersion()}
            disabled={refreshingVersion}
          >
            <RefreshCw size={12} className={refreshingVersion ? "spin" : undefined} />
            {refreshingVersion ? t("appSettings.refreshing") : t("common.refresh")}
          </button>
        </div>
        <div style={appSettingsHintStyle}>{t("appSettings.versionsHint")}</div>
      </div>

      <AgentConfigEditor
        resolvedFilePath={resolvedFilePath}
        fileState={fileState}
        editing={editing}
        saved={configSaved}
        saving={savingConfig}
        dirty={configDirty}
        onEdit={startEditingConfig}
        onCancel={handleCancelConfig}
        onSave={handleSaveConfig}
        onContentChange={(content) => setFileState({ status: "loaded", content })}
      />
    </section>
  );
}
