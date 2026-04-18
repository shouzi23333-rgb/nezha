use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

use crate::storage::atomic_write;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

// ── Version 缓存 ─────────────────────────────────────────────────────────────

static CACHED_CLAUDE_VERSION: OnceLock<Mutex<Option<Option<String>>>> = OnceLock::new();
static CACHED_CODEX_VERSION: OnceLock<Mutex<Option<Option<String>>>> = OnceLock::new();

// ── Login shell 环境解析 ─────────────────────────────────────────────────────

static LOGIN_SHELL_ENV: OnceLock<Vec<(String, String)>> = OnceLock::new();
static LOGIN_SHELL_PATH: OnceLock<String> = OnceLock::new();
const ENV_SENTINEL: &[u8] = b"__NEZHA_ENV_START__\0";

/// 返回用户 login shell 导出的完整环境变量。
/// 首次调用时执行 `$SHELL -l -i -c 'env -0'`，之后从缓存返回。
pub fn get_login_shell_env() -> &'static [(String, String)] {
    LOGIN_SHELL_ENV.get_or_init(resolve_login_shell_env).as_slice()
}

/// 返回用户 login shell 解析后的完整 PATH。
/// 基于缓存的 login shell 环境提取，避免重复启动 shell。
pub fn get_login_shell_path() -> &'static str {
    LOGIN_SHELL_PATH.get_or_init(|| {
        get_login_shell_env()
            .iter()
            .find(|(key, _)| key == "PATH")
            .map(|(_, value)| value.clone())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(build_fallback_path)
    })
}

fn resolve_login_shell_env() -> Vec<(String, String)> {
    // Windows 没有 login shell 概念，直接使用当前进程环境
    if cfg!(target_os = "windows") {
        return build_fallback_env();
    }

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    // -l: login shell，source .zprofile / .bash_profile
    // -i: interactive，source .zshrc / .bashrc（nvm 等通常在此初始化）
    if let Some(env) = read_shell_env(&shell, true) {
        return env;
    }

    // 降级：尝试不带 -i（兼容某些 rc 文件有交互式命令的情况）
    if let Some(env) = read_shell_env(&shell, false) {
        return env;
    }

    build_fallback_env()
}

fn read_shell_env(shell: &str, interactive: bool) -> Option<Vec<(String, String)>> {
    let args: &[&str] = if interactive {
        &["-l", "-i", "-c", "printf '__NEZHA_ENV_START__\\0'; env -0"]
    } else {
        &["-l", "-c", "printf '__NEZHA_ENV_START__\\0'; env -0"]
    };

    let output = Command::new(shell)
        .args(args)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    parse_shell_env_output(&output.stdout)
}

fn parse_shell_env_output(stdout: &[u8]) -> Option<Vec<(String, String)>> {
    let start = stdout
        .windows(ENV_SENTINEL.len())
        .position(|window| window == ENV_SENTINEL)?
        + ENV_SENTINEL.len();

    let mut env = Vec::new();
    for entry in stdout[start..].split(|byte| *byte == 0) {
        if entry.is_empty() {
            continue;
        }

        let Some(eq) = entry.iter().position(|byte| *byte == b'=') else {
            continue;
        };
        let key = String::from_utf8_lossy(&entry[..eq]).into_owned();
        if key.is_empty() || matches!(key.as_str(), "PWD" | "OLDPWD" | "SHLVL" | "_") {
            continue;
        }
        let value = String::from_utf8_lossy(&entry[eq + 1..]).into_owned();
        env.push((key, value));
    }

    if env.is_empty() {
        None
    } else {
        Some(env)
    }
}

fn build_fallback_path() -> String {
    let home = crate::storage::home_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let current = std::env::var("PATH").unwrap_or_default();
    let path_sep = if cfg!(target_os = "windows") { ";" } else { ":" };

    let extras: Vec<String> = if cfg!(target_os = "windows") {
        // Windows: 补充 home 下的常见工具路径
        vec![
            format!("{home}\\.claude\\bin"),
            format!("{home}\\.local\\bin"),
            format!("{home}\\AppData\\Roaming\\npm"),
        ]
    } else {
        vec![
            format!("{home}/.local/bin"),
            format!("{home}/.npm-global/bin"),
            "/opt/homebrew/bin".to_string(),
            "/opt/homebrew/sbin".to_string(),
            "/usr/local/bin".to_string(),
            "/usr/bin".to_string(),
            "/bin".to_string(),
            "/usr/sbin".to_string(),
            "/sbin".to_string(),
        ]
    };
    let mut parts: Vec<String> = extras.to_vec();
    for p in current.split(path_sep) {
        if !p.is_empty() && !parts.contains(&p.to_string()) {
            parts.push(p.to_string());
        }
    }
    parts.join(path_sep)
}

fn build_fallback_env() -> Vec<(String, String)> {
    let mut env: Vec<(String, String)> = std::env::vars()
        .filter(|(key, _)| !matches!(key.as_str(), "PWD" | "OLDPWD" | "SHLVL" | "_"))
        .collect();

    if let Some((_, path)) = env.iter_mut().find(|(key, _)| key == "PATH") {
        *path = build_fallback_path();
    } else {
        env.push(("PATH".to_string(), build_fallback_path()));
    }

    if !env.iter().any(|(key, _)| key == "HOME") {
        if let Ok(home) = crate::storage::home_dir() {
            let home_str = home.to_string_lossy().into_owned();
            if !home_str.is_empty() {
                env.push(("HOME".to_string(), home_str));
            }
        }
    }

    env
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AppSettings {
    #[serde(default)]
    pub claude_path: String,
    #[serde(default)]
    pub codex_path: String,
}

fn get_agent_bin_from_settings(settings: &AppSettings, agent: &str) -> String {
    match agent {
        "codex" => {
            if settings.codex_path.is_empty() {
                "codex".to_string()
            } else {
                settings.codex_path.clone()
            }
        }
        _ => {
            if settings.claude_path.is_empty() {
                "claude".to_string()
            } else {
                settings.claude_path.clone()
            }
        }
    }
}

fn clear_cached_versions() {
    *CACHED_CLAUDE_VERSION
        .get_or_init(|| Mutex::new(None))
        .lock() = None;
    *CACHED_CODEX_VERSION
        .get_or_init(|| Mutex::new(None))
        .lock() = None;
}

fn nezha_dir() -> Result<PathBuf, String> {
    Ok(crate::storage::home_dir()?.join(".nezha"))
}

fn settings_path() -> Result<PathBuf, String> {
    Ok(nezha_dir()?.join("settings.json"))
}

#[tauri::command]
pub fn get_current_platform() -> String {
    std::env::consts::OS.to_string()
}

/// 执行 `which`（Unix）或 `where.exe` + PowerShell 兜底（Windows）返回完整路径，
/// 找不到则返回空字符串。
fn detect_path(binary: &str) -> String {
    if cfg!(target_os = "windows") {
        return detect_path_windows(binary);
    }

    let shell_path = get_login_shell_path();
    let output = crate::command_no_window("which")
        .arg(binary)
        .env("PATH", shell_path)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Some(p) = stdout.lines().map(|l| l.trim()).find(|l| !l.is_empty()) {
                return p.to_string();
            }
        }
    }
    String::new()
}

/// Windows 专用路径探测：先用 `where.exe`，失败则用 PowerShell `Get-Command`。
/// 通过 `choose_windows_command_path` 在多个候选中优先选 `.cmd > .bat > .exe`。
fn detect_path_windows(binary: &str) -> String {
    let shell_path = get_login_shell_path();

    let output = crate::command_no_window("where.exe")
        .arg(binary)
        .env("PATH", shell_path)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let candidates: Vec<String> = String::from_utf8_lossy(&out.stdout)
                .lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect();
            if let Some(path) = choose_windows_command_path(&candidates) {
                return path;
            }
        }
    }

    // 兜底：PowerShell Get-Command（where.exe 找不到脚本路径时有效）
    let ps_command = format!(
        "$cmd = Get-Command {binary} -ErrorAction SilentlyContinue; if ($cmd) {{ $cmd.Source }}"
    );
    let output = crate::command_no_window("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-Command", &ps_command])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let candidates: Vec<String> = String::from_utf8_lossy(&out.stdout)
                .lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect();
            if let Some(path) = choose_windows_command_path(&candidates) {
                return path;
            }
        }
    }

    String::new()
}

/// 从候选路径列表中按 `.cmd > .bat > .exe` 优先级选出最合适的。
/// Node.js 全局安装的工具通常只有 `.cmd` shim，优先选它而非同名 `.exe`。
fn choose_windows_command_path(candidates: &[String]) -> Option<String> {
    for ext in [".cmd", ".bat", ".exe"] {
        if let Some(path) = candidates
            .iter()
            .find(|p| p.to_ascii_lowercase().ends_with(ext))
        {
            return Some(path.clone());
        }
    }
    candidates.first().cloned()
}

/// 内部工具函数：从文件读取设置。文件不存在时自动检测并保存。
pub fn load_settings_internal() -> AppSettings {
    let path = match settings_path() {
        Ok(p) => p,
        Err(_) => return AppSettings::default(),
    };

    if !path.exists() {
        // 首次启动：用 which 自动检测并保存
        let settings = AppSettings {
            claude_path: detect_path("claude"),
            codex_path: detect_path("codex"),
        };
        if let Ok(dir) = nezha_dir() {
            let _ = fs::create_dir_all(&dir);
        }
        if let Ok(raw) = serde_json::to_string_pretty(&settings) {
            let _ = atomic_write(&path, &raw);
        }
        return settings;
    }

    let raw = match fs::read_to_string(&path) {
        Ok(r) => r,
        Err(_) => return AppSettings::default(),
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

/// 在 Windows 上将裸路径（无扩展名）解析为实际可执行文件。
/// 优先级：.exe > .cmd > 原路径。
/// 非 Windows 平台直接返回原路径。
fn resolve_executable(bin: String) -> String {
    #[cfg(target_os = "windows")]
    {
        let path = std::path::Path::new(&bin);
        // 已有合法扩展名，直接返回
        if let Some(ext) = path.extension() {
            let ext_lower = ext.to_string_lossy().to_lowercase();
            if matches!(ext_lower.as_str(), "exe" | "cmd" | "bat" | "com") {
                return bin;
            }
        }
        // 优先查找 .exe（原生 PE，CreateProcessW 可直接执行）
        let exe_path = format!("{}.exe", bin);
        if std::path::Path::new(&exe_path).exists() {
            return exe_path;
        }
        // 其次查找 .cmd（npm 全局安装的 shim 脚本）
        let cmd_path = format!("{}.cmd", bin);
        if std::path::Path::new(&cmd_path).exists() {
            return cmd_path;
        }
    }
    bin
}

/// 根据 agent 名称（"claude" 或 "codex"）返回对应的可执行文件路径。
/// 若配置为空，则回退到直接使用二进制名称。
/// Windows 上会自动解析 .exe/.cmd 后缀，确保 CreateProcessW 可正常执行。
pub fn get_agent_bin(agent: &str) -> String {
    resolve_executable(get_agent_bin_from_settings(&load_settings_internal(), agent))
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn load_app_settings() -> Result<AppSettings, String> {
    Ok(load_settings_internal())
}

#[tauri::command]
pub fn save_app_settings(settings: AppSettings) -> Result<(), String> {
    let dir = nezha_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = settings_path()?;
    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    atomic_write(&path, &raw)?;
    clear_cached_versions();
    Ok(())
}

#[tauri::command]
pub fn detect_agent_paths() -> Result<AppSettings, String> {
    Ok(AppSettings {
        claude_path: detect_path("claude"),
        codex_path: detect_path("codex"),
    })
}

// ── Version detection ──────────────────────────────────────────────────────────

/// 运行 `<binary> --version` 解析版本号。
/// 支持的输出格式：
///   "2.1.87 (Claude Code)"   →  "2.1.87"
///   "OpenAI Codex v0.120.0"  →  "0.120.0"
///   "codex-cli 0.120.0"      →  "0.120.0"
///
/// Windows 上自动为 `.cmd`/`.bat`/`.ps1` 脚本选择正确的启动方式，
/// 并同时检查 stdout 和 stderr（部分工具将版本输出到 stderr）。
fn detect_version(binary: &str) -> Option<String> {
    let shell_path = get_login_shell_path();
    let output = crate::command_for_binary(binary)
        .arg("--version")
        .env("PATH", shell_path)
        .stdin(Stdio::null())
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    extract_version_token(&stdout).or_else(|| extract_version_token(&stderr))
}

/// 从文本中提取第一个语义化版本 token（支持 `v`/`V` 前缀）。
fn extract_version_token(text: &str) -> Option<String> {
    text.split_whitespace()
        .map(normalize_version_token)
        .find(|token| is_semver_like(token))
}

/// 去除版本 token 的 `v`/`V` 前缀及两端标点。
fn normalize_version_token(token: &str) -> String {
    token
        .trim()
        .trim_matches(|c: char| matches!(c, '(' | ')' | '[' | ']' | ',' | ';'))
        .trim_start_matches('v')
        .trim_start_matches('V')
        .to_string()
}

/// 判断 token 是否形如 "1.2.3"（只含数字和点，且两者都有）。
fn is_semver_like(token: &str) -> bool {
    let mut saw_digit = false;
    let mut saw_dot = false;
    for ch in token.chars() {
        if ch.is_ascii_digit() {
            saw_digit = true;
        } else if ch == '.' {
            saw_dot = true;
        } else {
            return false;
        }
    }
    saw_digit && saw_dot
}

fn detect_versions_for_settings(settings: &AppSettings) -> AgentVersions {
    AgentVersions {
        claude_version: detect_version(&get_agent_bin_from_settings(settings, "claude"))
            .unwrap_or_default(),
        codex_version: detect_version(&get_agent_bin_from_settings(settings, "codex"))
            .unwrap_or_default(),
    }
}

/// 将版本字符串解析为 (major, minor, patch) 三元组。
fn parse_semver(v: &str) -> (u32, u32, u32) {
    let parts: Vec<&str> = v.split('.').collect();
    (
        parts.first().and_then(|s| s.parse().ok()).unwrap_or(0),
        parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0),
        parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0),
    )
}

/// 检测 Claude Code 版本（进程级缓存）。
pub fn detect_claude_version() -> Option<String> {
    let cache = CACHED_CLAUDE_VERSION.get_or_init(|| Mutex::new(None));
    let mut guard = cache.lock();
    if let Some(version) = guard.clone() {
        return version;
    }

    let detected = detect_version(&get_agent_bin("claude"));
    *guard = Some(detected.clone());
    detected
}

/// 检测 Codex 版本（进程级缓存）。
pub fn detect_codex_version() -> Option<String> {
    let cache = CACHED_CODEX_VERSION.get_or_init(|| Mutex::new(None));
    let mut guard = cache.lock();
    if let Some(version) = guard.clone() {
        return version;
    }

    let detected = detect_version(&get_agent_bin("codex"));
    *guard = Some(detected.clone());
    detected
}

/// 判断 Claude Code 版本是否 >= 指定最低版本。
/// 优先使用已传入的 `saved_version`（来自项目配置），为空时再执行自动检测。
pub fn claude_version_gte(saved_version: &str, min_version: &str) -> bool {
    let version = if saved_version.is_empty() {
        match detect_claude_version() {
            Some(v) => v,
            None => return false,
        }
    } else {
        saved_version.to_string()
    };
    parse_semver(&version) >= parse_semver(min_version)
}

/// Tauri 命令：检测 Claude 和 Codex 的版本并返回。
#[tauri::command]
pub fn detect_agent_versions() -> Result<AgentVersions, String> {
    Ok(AgentVersions {
        claude_version: detect_claude_version().unwrap_or_default(),
        codex_version: detect_codex_version().unwrap_or_default(),
    })
}

#[tauri::command]
pub fn detect_agent_versions_for_settings(settings: AppSettings) -> Result<AgentVersions, String> {
    Ok(detect_versions_for_settings(&settings))
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AgentVersions {
    pub claude_version: String,
    pub codex_version: String,
}
