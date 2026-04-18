use parking_lot::Mutex;
use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::sync::Arc;

use usage::CodexRpcClient;

mod analytics;
mod app_settings;
mod config;
mod fs;
mod git;
mod notification;
mod pty;
mod session;
mod storage;
mod usage;

use session::{ClaudeSessionInfo, CodexSessionInfo};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
#[cfg(target_os = "windows")]
const SW_HIDE: u16 = 0;

#[cfg(target_os = "windows")]
fn apply_hidden_window_flags(cmd: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;

    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.show_window(SW_HIDE);
}

/// 创建不弹出控制台窗口的 Command。
/// Windows 上设置 CREATE_NO_WINDOW (0x08000000) 标志，
/// 防止 cmd.exe / git 等控制台程序产生可见窗口。
pub(crate) fn command_no_window(program: &str) -> std::process::Command {
    #[allow(unused_mut)]
    let mut cmd = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    {
        apply_hidden_window_flags(&mut cmd);
    }
    cmd
}

/// 为可执行文件（含脚本）创建 Command，同时抑制控制台窗口。
///
/// 相比 `command_no_window`，额外处理 Windows 上无法被 CreateProcess 直接执行的脚本：
/// - `.cmd` / `.bat` → `cmd.exe /C <binary>`
/// - `.ps1`          → `powershell.exe -NoLogo -NoProfile -File <binary>`
/// - 其他（`.exe` 或无扩展名）→ 直接 `Command::new(binary)`
///
/// 非 Windows 平台与 `command_no_window` 行为相同。
pub(crate) fn command_for_binary(binary: &str) -> std::process::Command {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let ext = std::path::Path::new(binary)
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase());
        let mut cmd = match ext.as_deref() {
            Some("ps1") => {
                let mut c = std::process::Command::new("powershell.exe");
                c.args(["-NoLogo", "-NoProfile", "-File", binary]);
                c
            }
            Some("cmd") | Some("bat") => {
                let mut c = std::process::Command::new("cmd.exe");
                c.args(["/C", binary]);
                c
            }
            _ => std::process::Command::new(binary),
        };
        apply_hidden_window_flags(&mut cmd);
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(binary)
    }
}

pub struct TaskManager {
    pub(crate) pty_masters: Mutex<HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>,
    pub(crate) pty_writers: Mutex<HashMap<String, Box<dyn Write + Send>>>,
    pub(crate) child_handles:
        Mutex<HashMap<String, Arc<std::sync::Mutex<Box<dyn portable_pty::Child + Send + Sync>>>>>,
    pub(crate) cancelled_tasks: Mutex<HashSet<String>>,
    pub(crate) codex_sessions: Mutex<HashMap<String, CodexSessionInfo>>,
    pub(crate) claude_sessions: Mutex<HashMap<String, ClaudeSessionInfo>>,
    pub(crate) claimed_session_paths: Mutex<HashSet<String>>,
    /// Persistent `codex app-server` process reused across `read_usage_snapshot` calls.
    pub(crate) codex_rpc: Arc<Mutex<Option<CodexRpcClient>>>,
}

impl TaskManager {
    /// Atomically remove a task/shell from all PTY maps (masters, writers, children).
    /// Locks are acquired in a fixed order to prevent deadlocks.
    pub(crate) fn remove_pty_handles(&self, id: &str) {
        let mut masters = self.pty_masters.lock();
        let mut writers = self.pty_writers.lock();
        let mut children = self.child_handles.lock();
        masters.remove(id);
        writers.remove(id);
        children.remove(id);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Windows: 将控制台代码页设为 UTF-8，使 ConPTY 子进程继承 UTF-8 编码
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn SetConsoleOutputCP(wCodePageID: u32) -> i32;
            fn SetConsoleCP(wCodePageID: u32) -> i32;
        }
        SetConsoleOutputCP(65001);
        SetConsoleCP(65001);
    }

    tauri::Builder::default()
        .setup(|_app| {
            // 后台预热 login shell 环境，避免第一次启动任务时阻塞
            std::thread::spawn(|| {
                crate::app_settings::get_login_shell_path();
            });
            Ok(())
        })
        .manage(TaskManager {
            pty_masters: Mutex::new(HashMap::new()),
            pty_writers: Mutex::new(HashMap::new()),
            child_handles: Mutex::new(HashMap::new()),
            cancelled_tasks: Mutex::new(HashSet::new()),
            codex_sessions: Mutex::new(HashMap::new()),
            claude_sessions: Mutex::new(HashMap::new()),
            claimed_session_paths: Mutex::new(HashSet::new()),
            codex_rpc: Arc::new(Mutex::new(None)),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pty::run_task,
            pty::resume_task,
            pty::cancel_task,
            pty::send_input,
            pty::resize_pty,
            pty::open_shell,
            pty::kill_shell,
            fs::read_dir_entries,
            fs::read_file_content,
            fs::read_image_preview,
            fs::write_file_content,
            fs::list_project_files,
            git::generate_commit_message,
            git::git_status,
            git::git_list_branches,
            git::git_create_branch,
            git::git_checkout_branch,
            git::git_log,
            git::git_commit_detail,
            git::git_show_diff,
            git::git_show_file_diff,
            git::git_file_diff,
            git::git_stage,
            git::git_unstage,
            git::git_stage_all,
            git::git_unstage_all,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_remote_counts,
            analytics::read_session_metrics,
            analytics::get_weekly_analytics,
            session::read_session_messages,
            config::init_project_config,
            config::read_project_config,
            config::write_project_config,
            config::read_agent_config_file,
            config::write_agent_config_file,
            storage::load_projects,
            storage::save_projects,
            storage::load_project_tasks,
            storage::save_project_tasks,
            app_settings::load_app_settings,
            app_settings::save_app_settings,
            app_settings::detect_agent_paths,
            app_settings::detect_agent_versions,
            app_settings::detect_agent_versions_for_settings,
            notification::get_notifications,
            notification::mark_notification_read,
            notification::mark_all_notifications_read,
            usage::read_usage_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
