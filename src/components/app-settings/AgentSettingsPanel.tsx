import s from "../../styles";
import { AgentConfigPanel } from "./AgentConfigPanel";
import { getAgentSettingsFilePath } from "./shared";
import type { SettingsPageKey } from "./types";

export function AgentSettingsPanel({
  activePage,
}: {
  activePage: Extract<SettingsPageKey, "agents" | "claude" | "codex">;
}) {
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
      {(activePage === "agents" || activePage === "claude") && (
        <AgentConfigPanel
          agentKey="claude"
          filePath={getAgentSettingsFilePath("claude")}
          title="Claude Code"
          embedded
        />
      )}
      {(activePage === "agents" || activePage === "codex") && (
        <AgentConfigPanel
          agentKey="codex"
          filePath={getAgentSettingsFilePath("codex")}
          title="Codex"
          embedded
        />
      )}
    </div>
  );
}
