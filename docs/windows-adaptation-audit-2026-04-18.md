# Windows 适配审计（2026-04-18）

本文件汇总当前分支中仍需处理的 Windows 适配问题，并按优先级给出修复建议。

## 当前状态

- 已修复：
  - `generate_commit_message` 的 Claude 可执行文件解析与 PATH 复用
  - 新打开项目时的跨平台项目名提取
  - 设置页中的平台相关路径文案和二进制 placeholder
  - Windows 路径辅助函数的前端测试覆盖
- 仍待处理：
  - Claude usage 的 Windows 支持
  - 若未来恢复 Makefile target 运行按钮，需要重新审视 Windows 行为

## 审计范围

- 前端：`src/`
- Tauri / Rust：`src-tauri/src/`
- 配置与设置文案
- 与 Windows 路径、Shell、可执行文件解析相关的逻辑

## 已确认需要修复

### P0: `generate_commit_message` 的 Claude 分支仍绕过 Windows 适配路径

状态：已修复

- 文件：[src-tauri/src/git.rs](/Users/xxbuff/Desktop/AICode/nezha/src-tauri/src/git.rs#L107)
- 关键位置：[src-tauri/src/git.rs](/Users/xxbuff/Desktop/AICode/nezha/src-tauri/src/git.rs#L157)

问题：

- `codex` 分支已经使用 `get_agent_bin("codex")` 和 `command_for_binary(...)`
- `claude` 分支仍直接执行 `command_no_window("claude")`
- 这会绕过：
  - 用户在设置中保存的 `claude_path`
  - Windows 下 `.cmd` / `.bat` shim 的包装逻辑
- 同时这里自己构造的 PATH 没复用 `app_settings.rs` 的 Windows fallback，少了 `%USERPROFILE%\\.claude\\bin`

影响：

- Windows 上 `generate_commit_message` 可能找不到 Claude
- 或者设置了自定义 Claude 路径后这里仍不生效

建议修复：

1. Claude 分支改为和 Codex 同样走 `get_agent_bin("claude")`
2. 用 `command_for_binary(&claude_bin)` 启动，而不是裸 `claude`
3. 抽一个共享 PATH 构造函数，避免 `git.rs` 和 `app_settings.rs` 各维护一套 Windows PATH fallback

### P1: 新打开项目时，项目名提取只按 `/` 分割

状态：已修复

- 文件：[src/App.tsx](/Users/xxbuff/Desktop/AICode/nezha/src/App.tsx#L164)
- 关键位置：[src/App.tsx](/Users/xxbuff/Desktop/AICode/nezha/src/App.tsx#L168)

问题：

- 当前逻辑：`path.split("/").pop() || path`
- Windows 路径如 `C:\\work\\nezha` 不会被正确拆分

影响：

- Windows 上新打开项目后，项目名可能显示成整条绝对路径，而不是目录名

建议修复：

1. 不要手写分隔符拆分
2. 提取一个跨平台 `basename` 辅助函数，统一处理 `\\` 和 `/`
3. 这个 helper 后续也可复用到别的展示逻辑

## 建议修复

### P1: Claude usage 目前明确只支持 macOS

状态：未修复

- 文件：[src-tauri/src/usage.rs](/Users/xxbuff/Desktop/AICode/nezha/src-tauri/src/usage.rs#L313)
- 关键位置：[src-tauri/src/usage.rs](/Users/xxbuff/Desktop/AICode/nezha/src-tauri/src/usage.rs#L314)

问题：

- 非 macOS 直接返回 unavailable
- 原因是当前实现依赖 macOS Keychain 的 `security find-generic-password`

影响：

- Windows 上 Usage 面板里 Claude usage 永远不可用

建议修复：

- 如果产品目标是 Windows 功能对齐，需要明确补一条 Windows 凭据读取方案
- 如果短期不做，至少在 UI 上将其标成“暂不支持 Windows”，不要让用户误以为是异常

### P2: 设置页仍有明显 Unix 文案

状态：已修复

- 文件：[src/components/AppSettingsDialog.tsx](/Users/xxbuff/Desktop/AICode/nezha/src/components/AppSettingsDialog.tsx#L58)
- 文件：[src/components/AppSettingsDialog.tsx](/Users/xxbuff/Desktop/AICode/nezha/src/components/AppSettingsDialog.tsx#L690)

问题：

- 显示路径写死为：
  - `~/.claude/settings.json`
  - `~/.codex/config.toml`
- 输入框 placeholder 写死为：
  - `/usr/local/bin/claude`
  - `/usr/local/bin/codex`

影响：

- 功能未必坏，但 Windows 用户会被明显误导
- 审美上也会让人感觉“这功能没做完”

建议修复：

1. 根据平台显示配置文件路径
2. 根据平台切换 placeholder
3. 如果不想在前端判断平台，就从 Rust 暴露 display path 给前端

### P2: Windows 分支缺少测试覆盖

状态：已部分修复

- 文件：[src/test/utils.test.ts](/Users/xxbuff/Desktop/AICode/nezha/src/test/utils.test.ts#L43)

问题：

- `shortenPath()` 已有 Windows 分支，但测试只覆盖了 macOS/Unix 路径
- 当前也没有覆盖“从绝对路径提取项目名”的 Windows 场景

影响：

- 后续回归时很容易再次把 Windows 路径处理改坏

建议修复：

1. 给 `shortenPath("C:\\Users\\john\\workspace\\nezha")` 增加断言
2. 把项目名提取逻辑抽成 helper 后补 Windows 用例
3. 如果修 `git.rs` 的 agent 路径解析，最好补一个最小单测或至少抽 helper 方便测试

## 低优先级 / 潜在问题

### P3: 残留的 `make` 命令是假定 Unix Shell 的

- 文件：[src/components/ProjectPage.tsx](/Users/xxbuff/Desktop/AICode/nezha/src/components/ProjectPage.tsx#L162)
- 关联位置：[src/components/FileViewer.tsx](/Users/xxbuff/Desktop/AICode/nezha/src/components/FileViewer.tsx#L438)

现状：

- `ProjectPage` 里还有 `make ${target}\n`
- 但 `FileViewer` 当前把 `onRunMakeTarget` 直接吃掉了，没有实际使用

判断：

- 这不是当前 Windows 的现网功能缺口
- 但如果以后重新启用“运行 Makefile target”按钮，这块会天然偏 Unix

建议：

- 若功能恢复，需要先决定 Windows 侧行为
- 可选方案：
  - 仅在存在 `make` 时显示
  - Windows 下隐藏
  - 改成按工具链判断执行 `make` / `just` / 自定义 shell command`

## 本次检查后，暂不建议动的点

以下位置虽然出现了 `/` 或 Unix 字样，但当前不构成明确 Windows bug：

- `GitChanges.tsx` / `GitHistory.tsx` 的路径拆分
  - 这里处理的是 Git 输出的 repo-relative path
  - Git 在 Windows 下也通常使用 `/`
- `NewTaskView.tsx` 的 `parseFileEntry()`
  - 这里消费的是 `git ls-files` 结果，不是原生绝对路径
- `pty.rs` / `app_settings.rs`
  - 已经有比较完整的 Windows 分支处理：`cmd.exe` 包装、`where.exe` 探测、PowerShell fallback、`USERPROFILE`、UTF-8 环境等

## 建议修复顺序

1. 修 `git.rs` 的 Claude 启动路径问题
2. 修 `App.tsx` 的项目名提取
3. 补 Windows 路径测试
4. 调整设置页的路径文案和 placeholder
5. 视产品目标决定是否补 Windows 的 Claude usage

## 本次审计执行记录

- 全仓搜索了 Windows / Unix 路径、Shell、可执行文件、路径拆分逻辑
- 重点复查了：
  - `src-tauri/src/git.rs`
  - `src-tauri/src/app_settings.rs`
  - `src-tauri/src/pty.rs`
  - `src-tauri/src/usage.rs`
  - `src/App.tsx`
  - `src/components/AppSettingsDialog.tsx`
- 验证命令：
  - `pnpm test -- --run src/test/utils.test.ts`
  - `cargo check`
