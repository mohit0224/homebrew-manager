use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use crate::metrics::MetricsState;

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

    let proc_names = match name {
        "mongodb-community" => vec!["mongod", "mongodb"],
        "redis" => vec!["redis-server", "redis"],
        "postgresql" | "postgresql@16" | "postgresql@15" | "postgresql@14" => vec!["postgres"],
        "nginx" => vec!["nginx"],
        "mysql" => vec!["mysqld"],
        _ => vec![name],
    };

    for p_name in proc_names {
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
        .args(["services", action, name])
        .output()
        .map_err(|e| format!("Command execution failed: {}", e))?;

    Ok(CommandOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

pub fn search_packages(query: &str) -> Result<Vec<SearchResultItem>, String> {
    validate_search_query(query)?;
    let brew = find_brew_binary();
    let output = Command::new(&brew)
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
            results.push(SearchResultItem {
                name: pkg.to_string(),
                description: None,
                version: None,
                is_installed: false,
            });
        }
    }

    results.truncate(25);
    Ok(results)
}

pub fn install_package(name: &str) -> Result<CommandOutput, String> {
    validate_name(name)?;
    let brew = find_brew_binary();
    let output = Command::new(&brew)
        .args(["install", name])
        .output()
        .map_err(|e| format!("Install failed: {}", e))?;

    Ok(CommandOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

pub fn uninstall_package(name: &str) -> Result<CommandOutput, String> {
    validate_name(name)?;
    let brew = find_brew_binary();

    // Stop the service first in case it is currently running
    let _ = Command::new(&brew)
        .args(["services", "stop", name])
        .output();

    let output = Command::new(&brew)
        .args(["uninstall", name])
        .output()
        .map_err(|e| format!("Uninstall failed: {}", e))?;

    Ok(CommandOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
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

pub fn upgrade_package(name: Option<&str>) -> Result<CommandOutput, String> {
    let brew = find_brew_binary();
    let mut cmd = Command::new(&brew);
    cmd.arg("upgrade");
    if let Some(pkg) = name {
        validate_name(pkg)?;
        cmd.arg(pkg);
    }

    let output = cmd.output().map_err(|e| format!("Upgrade failed: {}", e))?;

    Ok(CommandOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
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
