use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::Emitter;
use crate::metrics::MetricsState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BrewLogPayload {
    pub operation: String,
    pub target: String,
    pub stream: String,
    pub line: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BrewServiceItem {
    pub name: String,
    pub status: String,
    pub user: Option<String>,
    pub file: Option<String>,
    pub pid: Option<u32>,
    pub cpu: Option<f32>,
    pub memory: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResultItem {
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub is_installed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OutdatedItem {
    pub name: String,
    #[serde(alias = "installed_versions")]
    pub installed_versions: Vec<String>,
    #[serde(alias = "current_version")]
    pub current_version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPackageItem {
    pub name: String,
    #[serde(alias = "installed_versions")]
    pub installed_versions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrewSystemInfo {
    pub version: String,
    pub prefix: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub download_url: String,
    pub release_notes: String,
    pub published_at: Option<String>,
    pub html_url: String,
}

pub fn validate_name(input: &str) -> Result<(), String> {
    let re = Regex::new(r"^[a-zA-Z0-9_\-@./]+$").unwrap();
    if input.is_empty() || input.len() > 80 || !re.is_match(input) {
        return Err(format!("Invalid package or service name: {}", input));
    }
    Ok(())
}

pub fn validate_search_query(input: &str) -> Result<(), String> {
    let re = Regex::new(r"^[a-zA-Z0-9_\-@./ ]+$").unwrap();
    let trimmed = input.trim();
    if trimmed.is_empty() || trimmed.len() > 80 || !re.is_match(trimmed) {
        return Err(format!("Invalid search query: {}", input));
    }
    Ok(())
}

fn find_brew_binary() -> String {
    let paths = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
    for path in &paths {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }
    "brew".to_string()
}

fn get_launchctl_pids() -> HashMap<String, u32> {
    let mut map = HashMap::new();
    if let Ok(output) = Command::new("launchctl").arg("list").output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                if let Ok(pid) = parts[0].parse::<u32>() {
                    let label = parts[2];
                    map.insert(label.to_string(), pid);
                }
            }
        }
    }
    map
}

fn find_service_pid(name: &str, file: Option<&str>, launchctl_map: &HashMap<String, u32>) -> Option<u32> {
    if let Some(f) = file {
        let path = std::path::Path::new(f);
        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
            if let Some(&pid) = launchctl_map.get(stem) {
                return Some(pid);
            }
        }
    }

    let candidate_labels = [
        format!("sh.brew.{}", name),
        format!("homebrew.mxcl.{}", name),
        format!("{}.{}", name, name),
        name.to_string(),
    ];
    for label in &candidate_labels {
        if let Some(&pid) = launchctl_map.get(label) {
            return Some(pid);
        }
    }

    let proc_names: &[&str] = match name {
        "mongodb-community" => &["mongod", "mongodb"],
        "redis" => &["redis-server", "redis"],
        "postgresql" | "postgresql@16" | "postgresql@15" | "postgresql@14" => &["postgres"],
        "nginx" => &["nginx"],
        "mysql" => &["mysqld"],
        _ => &[],
    };

    for &p_name in proc_names {
        if let Ok(output) = Command::new("pgrep").arg("-x").arg(p_name).output() {
            let out_str = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = out_str.lines().next() {
                if let Ok(pid) = first_line.trim().parse::<u32>() {
                    return Some(pid);
                }
            }
        }
    }

    None
}

pub fn list_services(metrics: &MetricsState) -> Result<Vec<BrewServiceItem>, String> {
    let brew = find_brew_binary();
    let launchctl_map = get_launchctl_pids();

    let output = Command::new(&brew)
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .args(["services", "list", "--json"])
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout_str = String::from_utf8_lossy(&out.stdout);
                if let Ok(raw_list) = serde_json::from_str::<Vec<serde_json::Value>>(&stdout_str) {
                    let mut result = Vec::new();
                    for item in raw_list {
                        let name = item["name"].as_str().unwrap_or("").to_string();
                        let mut status = item["status"].as_str().unwrap_or("none").to_string();
                        let user = item["user"].as_str().map(|s| s.to_string());
                        let file = item["file"].as_str().map(|s| s.to_string());

                        let mut pid = if status == "stopped" {
                            None
                        } else {
                            item["pid"].as_u64().map(|p| p as u32)
                        };

                        if pid.is_none() && status != "stopped" {
                            pid = find_service_pid(&name, file.as_deref(), &launchctl_map);
                        }

                        // Only if status was unregistered/none and an active PID was found, promote to started
                        if pid.is_some() && (status == "none" || status.is_empty()) {
                            status = "started".to_string();
                        }

                        let mut cpu = None;
                        let mut memory = None;
                        if let Some(p) = pid {
                            if let Some(proc_stats) = metrics.get_process_metrics(p) {
                                cpu = Some(proc_stats.cpu_percent);
                                memory = Some(proc_stats.memory_mb);
                            }
                        }

                        result.push(BrewServiceItem {
                            name,
                            status,
                            user,
                            file,
                            pid,
                            cpu,
                            memory,
                        });
                    }
                    return Ok(result);
                }
            }
            parse_services_text_output(&brew, metrics, &launchctl_map)
        }
        Err(e) => Err(format!("Failed to execute brew: {}", e)),
    }
}

fn parse_services_text_output(
    brew: &str,
    metrics: &MetricsState,
    launchctl_map: &HashMap<String, u32>,
) -> Result<Vec<BrewServiceItem>, String> {
    let output = Command::new(brew)
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .args(["services", "list"])
        .output()
        .map_err(|e| e.to_string())?;

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut services = Vec::new();

    for line in stdout_str.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        let name = parts[0].to_string();
        let mut status = if parts.len() > 1 { parts[1].to_string() } else { "none".to_string() };
        let mut user = None;
        let mut file = None;

        if parts.len() > 2 {
            user = Some(parts[2].to_string());
        }
        if parts.len() > 3 {
            file = Some(parts[3].to_string());
        }

        let pid = if status == "stopped" {
            None
        } else {
            find_service_pid(&name, file.as_deref(), launchctl_map)
        };

        if status != "stopped" && pid.is_some() && (status == "none" || status.is_empty()) {
            status = "started".to_string();
        }

        let mut cpu = None;
        let mut memory = None;
        if let Some(p) = pid {
            if let Some(proc_stats) = metrics.get_process_metrics(p) {
                cpu = Some(proc_stats.cpu_percent);
                memory = Some(proc_stats.memory_mb);
            }
        }

        services.push(BrewServiceItem {
            name,
            status,
            user,
            file,
            pid,
            cpu,
            memory,
        });
    }

    Ok(services)
}

pub fn manage_service(action: &str, name: &str) -> Result<CommandOutput, String> {
    validate_name(name)?;
    let brew = find_brew_binary();
    let valid_actions = ["start", "stop", "restart"];
    if !valid_actions.contains(&action) {
        return Err(format!("Invalid service action: {}", action));
    }

    let output = Command::new(&brew)
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .args(["services", action, name])
        .output()
        .map_err(|e| format!("Command execution failed: {}", e))?;

    Ok(CommandOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

pub fn search_packages(
    query: &str,
    installed_set: Option<&std::collections::HashSet<String>>,
) -> Result<Vec<SearchResultItem>, String> {
    validate_search_query(query)?;
    let brew = find_brew_binary();
    let output = Command::new(&brew)
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .args(["search", query])
        .output()
        .map_err(|e| format!("Brew search failed: {}", e))?;

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout_str.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("==>") {
            continue;
        }

        for pkg in trimmed.split_whitespace() {
            if pkg.is_empty() {
                continue;
            }
            let pkg_lower = pkg.to_lowercase();
            let is_installed = if let Some(set) = installed_set {
                set.contains(&pkg_lower)
                    || set.iter().any(|inst| {
                        inst == &pkg_lower
                            || inst.split('/').last() == Some(&pkg_lower.as_str())
                            || pkg_lower.split('/').last() == Some(&inst.as_str())
                    })
            } else {
                false
            };

            results.push(SearchResultItem {
                name: pkg.to_string(),
                description: None,
                version: None,
                is_installed,
            });
        }
    }

    results.truncate(25);
    Ok(results)
}

pub fn run_brew_command_streaming(
    app: Option<&tauri::AppHandle>,
    operation: &str,
    target: &str,
    args: &[&str],
) -> Result<CommandOutput, String> {
    let brew = find_brew_binary();
    let mut cmd = Command::new(&brew);
    cmd.env("HOMEBREW_NO_AUTO_UPDATE", "1");
    cmd.args(args);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Command spawn failed: {}", e))?;

    let stdout_pipe = child.stdout.take().ok_or("Failed to open stdout pipe")?;
    let stderr_pipe = child.stderr.take().ok_or("Failed to open stderr pipe")?;

    let app_out = app.cloned();
    let op_out = operation.to_string();
    let tgt_out = target.to_string();

    let stdout_thread = std::thread::spawn(move || {
        let mut collected = String::new();
        let reader = BufReader::new(stdout_pipe);
        for line_res in reader.lines() {
            if let Ok(line) = line_res {
                if let Some(ref a) = app_out {
                    let _ = a.emit(
                        "brew-log-line",
                        BrewLogPayload {
                            operation: op_out.clone(),
                            target: tgt_out.clone(),
                            stream: "stdout".to_string(),
                            line: line.clone(),
                        },
                    );
                }
                if collected.len() < 500_000 {
                    collected.push_str(&line);
                    collected.push('\n');
                }
            }
        }
        collected
    });

    let app_err = app.cloned();
    let op_err = operation.to_string();
    let tgt_err = target.to_string();

    let stderr_thread = std::thread::spawn(move || {
        let mut collected = String::new();
        let reader = BufReader::new(stderr_pipe);
        for line_res in reader.lines() {
            if let Ok(line) = line_res {
                if let Some(ref a) = app_err {
                    let _ = a.emit(
                        "brew-log-line",
                        BrewLogPayload {
                            operation: op_err.clone(),
                            target: tgt_err.clone(),
                            stream: "stderr".to_string(),
                            line: line.clone(),
                        },
                    );
                }
                if collected.len() < 500_000 {
                    collected.push_str(&line);
                    collected.push('\n');
                }
            }
        }
        collected
    });

    let stdout = stdout_thread.join().unwrap_or_default();
    let stderr = stderr_thread.join().unwrap_or_default();
    let status = child.wait().map_err(|e| format!("Command wait failed: {}", e))?;

    Ok(CommandOutput {
        success: status.success(),
        stdout,
        stderr,
    })
}

pub fn install_package(app: Option<&tauri::AppHandle>, name: &str) -> Result<CommandOutput, String> {
    validate_name(name)?;
    run_brew_command_streaming(app, "install", name, &["install", name])
}

pub fn uninstall_package(app: Option<&tauri::AppHandle>, name: &str) -> Result<CommandOutput, String> {
    validate_name(name)?;
    let brew = find_brew_binary();

    // Stop the service first in case it is currently running
    let _ = Command::new(&brew)
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .args(["services", "stop", name])
        .output();

    run_brew_command_streaming(app, "uninstall", name, &["uninstall", name])
}

pub fn get_all_installed_packages() -> Result<Vec<InstalledPackageItem>, String> {
    let brew = find_brew_binary();
    let output = Command::new(&brew)
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .args(["list", "--versions"])
        .output()
        .map_err(|e| format!("Failed to list installed packages: {}", e))?;

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout_str.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("==>") || trimmed.starts_with("✘") {
            continue;
        }
        let mut parts = trimmed.split_whitespace();
        if let Some(name) = parts.next() {
            let installed_versions: Vec<String> = parts.map(|s| s.to_string()).collect();
            results.push(InstalledPackageItem {
                name: name.to_string(),
                installed_versions,
            });
        }
    }

    Ok(results)
}

pub fn get_outdated_packages() -> Result<Vec<OutdatedItem>, String> {
    let brew = find_brew_binary();
    let output = Command::new(&brew)
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .args(["outdated", "--json=v2"])
        .output()
        .map_err(|e| format!("Outdated check failed: {}", e))?;

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout_str) {
        let mut results = Vec::new();
        if let Some(formulae) = parsed["formulae"].as_array() {
            for f in formulae {
                let name = f["name"].as_str().unwrap_or("").to_string();
                let current_version = f["current_version"].as_str().unwrap_or("").to_string();
                let mut installed_versions = Vec::new();
                if let Some(inst) = f["installed_versions"].as_array() {
                    for v in inst {
                        if let Some(s) = v.as_str() {
                            installed_versions.push(s.to_string());
                        }
                    }
                }
                results.push(OutdatedItem {
                    name,
                    installed_versions,
                    current_version,
                });
            }
        }
        if let Some(casks) = parsed["casks"].as_array() {
            for c in casks {
                let name = c["name"].as_str().unwrap_or("").to_string();
                let current_version = c["current_version"].as_str().unwrap_or("").to_string();
                let mut installed_versions = Vec::new();
                if let Some(inst) = c["installed_versions"].as_array() {
                    for v in inst {
                        if let Some(s) = v.as_str() {
                            installed_versions.push(s.to_string());
                        }
                    }
                } else if let Some(s) = c["installed_versions"].as_str() {
                    installed_versions.push(s.to_string());
                }
                results.push(OutdatedItem {
                    name,
                    installed_versions,
                    current_version,
                });
            }
        }
        return Ok(results);
    }

    Ok(Vec::new())
}

pub fn upgrade_package(app: Option<&tauri::AppHandle>, name: Option<&str>) -> Result<CommandOutput, String> {
    if let Some(pkg) = name {
        validate_name(pkg)?;
        run_brew_command_streaming(app, "upgrade", pkg, &["upgrade", pkg])
    } else {
        run_brew_command_streaming(app, "upgrade", "all", &["upgrade"])
    }
}

pub fn send_notification(title: &str, body: &str) -> Result<(), String> {
    let clean_title = title
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', "")
        .replace('\n', " ");
    let clean_body = body
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', "")
        .replace('\n', " ");

    let script = format!(
        r#"display notification "{}" with title "{}" sound name "Ping""#,
        clean_body,
        clean_title
    );

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("Notification failed: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

pub fn get_system_brew_info() -> Result<BrewSystemInfo, String> {
    let brew = find_brew_binary();
    
    let version_output = Command::new(&brew)
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to get brew version: {}", e))?;
    
    let version_str = String::from_utf8_lossy(&version_output.stdout);
    let version = version_str
        .lines()
        .next()
        .unwrap_or("Homebrew")
        .trim()
        .to_string();

    let prefix_output = Command::new(&brew)
        .arg("--prefix")
        .output()
        .map_err(|e| format!("Failed to get brew prefix: {}", e))?;
    
    let prefix = String::from_utf8_lossy(&prefix_output.stdout).trim().to_string();

    Ok(BrewSystemInfo {
        version,
        prefix,
        is_active: version_output.status.success(),
    })
}

fn parse_version_parts(version: &str) -> Vec<u32> {
    let cleaned = version
        .trim()
        .trim_start_matches('v')
        .trim_start_matches('V');
    let core = cleaned.split('-').next().unwrap_or(cleaned);
    core.split('.')
        .map(|part| part.trim().parse::<u32>().unwrap_or(0))
        .collect()
}

pub fn is_newer_version(current: &str, latest: &str) -> bool {
    let curr_parts = parse_version_parts(current);
    let latest_parts = parse_version_parts(latest);
    let max_len = std::cmp::max(curr_parts.len(), latest_parts.len());

    for i in 0..max_len {
        let c = *curr_parts.get(i).unwrap_or(&0);
        let l = *latest_parts.get(i).unwrap_or(&0);
        if l > c {
            return true;
        }
        if l < c {
            return false;
        }
    }
    false
}

pub fn check_app_update_release() -> Result<AppUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let repo = "mohit0224/homebrew-manager";
    let default_download_url = format!(
        "https://github.com/{}/releases/latest/download/HomeBrew.Manager.dmg",
        repo
    );
    let releases_html_url = format!("https://github.com/{}/releases", repo);
    let api_url = format!("https://api.github.com/repos/{}/releases/latest", repo);

    let output = Command::new("curl")
        .args([
            "-fsSL",
            "-H",
            "Accept: application/vnd.github+json",
            "-H",
            "User-Agent: HomeBrew-Manager-Updater",
            &api_url,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout_str = String::from_utf8_lossy(&out.stdout);
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout_str) {
                let raw_tag = json["tag_name"]
                    .as_str()
                    .unwrap_or(&current_version)
                    .trim();
                let latest_version = raw_tag
                    .trim_start_matches('v')
                    .trim_start_matches('V')
                    .to_string();

                let mut download_url = default_download_url.clone();
                if let Some(assets) = json["assets"].as_array() {
                    for asset in assets {
                        let name = asset["name"].as_str().unwrap_or("");
                        if name.to_lowercase().ends_with(".dmg") {
                            if let Some(url) = asset["browser_download_url"].as_str() {
                                download_url = url.to_string();
                                break;
                            }
                        }
                    }
                }

                let release_notes = json["body"]
                    .as_str()
                    .unwrap_or("New update available with performance improvements and features.")
                    .to_string();
                let published_at = json["published_at"].as_str().map(|s| s.to_string());
                let html_url = json["html_url"]
                    .as_str()
                    .unwrap_or(&releases_html_url)
                    .to_string();

                let update_available = is_newer_version(&current_version, &latest_version);

                return Ok(AppUpdateInfo {
                    current_version,
                    latest_version,
                    update_available,
                    download_url,
                    release_notes,
                    published_at,
                    html_url,
                });
            }
        }
        _ => {}
    }

    Ok(AppUpdateInfo {
        current_version: current_version.clone(),
        latest_version: current_version,
        update_available: false,
        download_url: default_download_url,
        release_notes: "You are running the latest version of HomeBrew Manager.".to_string(),
        published_at: None,
        html_url: releases_html_url,
    })
}

pub fn install_app_update_release(download_url: Option<&str>) -> Result<CommandOutput, String> {
    let repo = "mohit0224/homebrew-manager";
    let default_url = format!(
        "https://github.com/{}/releases/latest/download/HomeBrew.Manager.dmg",
        repo
    );
    let fallback_url = format!(
        "https://github.com/{}/releases/latest/download/HomeBrew%20Manager.dmg",
        repo
    );

    let target_url = match download_url {
        Some(u) if !u.trim().is_empty() => {
            let trimmed = u.trim();
            if !trimmed.starts_with("https://github.com/mohit0224/homebrew-manager/")
                && !trimmed.starts_with("https://objects.githubusercontent.com/")
                && !trimmed.starts_with("https://release-assets.githubusercontent.com/")
            {
                return Err("Invalid update download URL origin.".to_string());
            }
            trimmed.to_string()
        }
        _ => default_url,
    };

    let script = format!(
        r#"set -e
APP_NAME="HomeBrew Manager"
DMG_URL="{target_url}"
FALLBACK_DMG_URL="{fallback_url}"

TMP_DIR="$(mktemp -d)"
DMG_PATH="${{TMP_DIR}}/${{APP_NAME}}.dmg"
MOUNT_DIR="${{TMP_DIR}}/mount"

cleanup() {{
  if [ -d "$MOUNT_DIR" ]; then
    hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}}
trap cleanup EXIT

if ! curl -fsSL -L "$DMG_URL" -o "$DMG_PATH"; then
  curl -fsSL -L "$FALLBACK_DMG_URL" -o "$DMG_PATH"
fi

mkdir -p "$MOUNT_DIR"
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -nobrowse -quiet

APP_SRC=$(find "$MOUNT_DIR" -maxdepth 1 -name "*.app" | head -n 1)
if [ -z "$APP_SRC" ]; then
  echo "Error: Could not find .app bundle inside the downloaded DMG." >&2
  exit 1
fi

APP_ACTUAL_NAME="$(basename "$APP_SRC")"
APP_TARGET="/Applications/${{APP_ACTUAL_NAME}}"

if [ -d "$APP_TARGET" ]; then
  rm -rf "$APP_TARGET"
fi
cp -R "$APP_SRC" /Applications/

hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true

xattr -cr "$APP_TARGET"
codesign --force --deep --sign - "$APP_TARGET" 2>/dev/null || true

echo "Update installed successfully"
"#
    );

    let output = Command::new("/bin/bash")
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to execute update installer: {}", e))?;

    Ok(CommandOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

pub fn schedule_app_auto_restart() {
    let current_pid = std::process::id();
    std::thread::spawn(move || {
        // Give IPC response and notification 800ms to display before terminating
        std::thread::sleep(std::time::Duration::from_millis(800));

        let relaunch_script = format!(
            "while kill -0 {pid} 2>/dev/null; do sleep 0.1; done; sleep 0.4; killall 'HomeBrew Manager' 2>/dev/null || true; sleep 0.3; open -n -a 'HomeBrew Manager' || open -n '/Applications/HomeBrew Manager.app'",
            pid = current_pid
        );

        let _ = Command::new("/usr/bin/nohup")
            .arg("/bin/sh")
            .arg("-c")
            .arg(&relaunch_script)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();

        std::process::exit(0);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_name() {
        assert!(validate_name("redis").is_ok());
        assert!(validate_name("postgresql@16").is_ok());
        assert!(validate_name("mongodb-community").is_ok());
        assert!(validate_name("").is_err());
        assert!(validate_name("bad name with spaces").is_err());
        assert!(validate_name("semi;colon").is_err());
    }

    #[test]
    fn test_validate_search_query() {
        assert!(validate_search_query("node").is_ok());
        assert!(validate_search_query("python 3").is_ok());
        assert!(validate_search_query("").is_err());
        assert!(validate_search_query("   ").is_err());
    }

    #[test]
    fn test_is_newer_version() {
        assert!(is_newer_version("0.1.0", "0.2.0"));
        assert!(is_newer_version("1.0.0", "1.0.1"));
        assert!(!is_newer_version("1.0.1", "1.0.0"));
        assert!(!is_newer_version("2.0.0", "2.0.0"));
        assert!(is_newer_version("v1.2.3", "v1.2.4"));
    }
}
