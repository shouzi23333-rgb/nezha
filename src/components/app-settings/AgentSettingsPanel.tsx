import s from "../../styles";
import { AgentConfigPanel } from "./AgentConfigPanel";
import { AgentPathsSection } from "./AgentPathsSection";
import { getAgentSettingsFilePath } from "./shared";
import type { SettingsPageKey } from "./types";

export function AgentSettingsPanel({
  activePage,
  isDark,
}: {
  activePage: Extract<SettingsPageKey, "agent-paths" | "claude" | "codex">;
  isDark: boolean;
}) {
  return (
    <div
      style={{
        ...s.settingsBody,
        display: "flex",
        flexDirection: "column",
        padding: "20px",
      }}
    >
      {activePage === "agent-paths" ? (
        <AgentPathsSection />
      ) : activePage === "claude" ? (
        <AgentConfigPanel
          agentKey="claude"
          filePath={getAgentSettingsFilePath("claude")}
          lang="json"
          isDark={isDark}
          embedded
        />
      ) : (
        <AgentConfigPanel
          agentKey="codex"
          filePath={getAgentSettingsFilePath("codex")}
          lang="toml"
          isDark={isDark}
          embedded
        />
      )}
    </div>
  );
}
