pub mod bootstrap;
pub mod brew;
pub mod metrics;

use bootstrap::BootstrapState;
use brew::{
    install_package, manage_service, search_packages, send_notification, uninstall_package,
    upgrade_package, BrewServiceItem, BrewSystemInfo, CommandOutput, InstalledPackageItem,
    OutdatedItem, SearchResultItem,
};
use metrics::{MetricsState, SystemMetrics};
use tauri::{Manager, State, WindowEvent};
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
fn get_services(
    state: State<MetricsState>,
    bootstrap: State<BootstrapState>,
) -> Result<Vec<BrewServiceItem>, String> {
    bootstrap.get_services(&state)
}

#[tauri::command]
fn start_service(name: String) -> Result<CommandOutput, String> {
    manage_service("start", &name)
}

#[tauri::command]
fn stop_service(name: String) -> Result<CommandOutput, String> {
    manage_service("stop", &name)
}

#[tauri::command]
fn restart_service(name: String) -> Result<CommandOutput, String> {
    manage_service("restart", &name)
}

#[tauri::command]
fn search_brew_packages(query: String) -> Result<Vec<SearchResultItem>, String> {
    search_packages(&query)
}

#[tauri::command]
fn install_brew_package(
    name: String,
    bootstrap: State<BootstrapState>,
) -> Result<CommandOutput, String> {
    let res = install_package(&name)?;
    let b = bootstrap.inner().clone();
    std::thread::spawn(move || {
        let _ = b.get_installed_packages(true);
        let _ = b.get_outdated(true);
    });
    Ok(res)
}

#[tauri::command]
fn uninstall_brew_package(
    name: String,
    bootstrap: State<BootstrapState>,
) -> Result<CommandOutput, String> {
    let res = uninstall_package(&name)?;
    let b = bootstrap.inner().clone();
    std::thread::spawn(move || {
        let _ = b.get_installed_packages(true);
        let _ = b.get_outdated(true);
    });
    Ok(res)
}

#[tauri::command]
fn get_installed_packages(
    force_refresh: Option<bool>,
    bootstrap: State<BootstrapState>,
) -> Result<Vec<InstalledPackageItem>, String> {
    bootstrap.get_installed_packages(force_refresh.unwrap_or(false))
}

#[tauri::command]
fn get_outdated(
    force_refresh: Option<bool>,
    bootstrap: State<BootstrapState>,
) -> Result<Vec<OutdatedItem>, String> {
    bootstrap.get_outdated(force_refresh.unwrap_or(false))
}

#[tauri::command]
fn upgrade_brew_package(
    name: Option<String>,
    bootstrap: State<BootstrapState>,
) -> Result<CommandOutput, String> {
    let res = upgrade_package(name.as_deref())?;
    let b = bootstrap.inner().clone();
    std::thread::spawn(move || {
        let _ = b.get_installed_packages(true);
        let _ = b.get_outdated(true);
    });
    Ok(res)
}

#[tauri::command]
fn get_system_metrics(state: State<MetricsState>) -> Result<SystemMetrics, String> {
    Ok(state.get_system_metrics())
}

#[tauri::command]
fn trigger_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    let res = match app
        .notification()
        .builder()
        .title(&title)
        .body(&body)
        .sound("Ping")
        .show()
    {
        Ok(_) => Ok(()),
        Err(e) => {
            eprintln!("Native notification failed, falling back to osascript: {e}");
            send_notification(&title, &body)
        }
    };

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("afplay")
            .arg("/System/Library/Sounds/Ping.aiff")
            .spawn();
    }

    res
}

#[tauri::command]
fn trigger_test_notification(title: String, body: String) -> Result<(), String> {
    send_notification(&title, &body)
}

#[tauri::command]
fn get_brew_info(bootstrap: State<BootstrapState>) -> Result<BrewSystemInfo, String> {
    bootstrap.get_brew_info()
}

#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let metrics_state = MetricsState::new();
    let bootstrap_state = BootstrapState::new();
    bootstrap_state.start_bootstrap(metrics_state.clone());

    tauri::Builder::default()
        .manage(metrics_state)
        .manage(bootstrap_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Safety timeout: ensure main window is visible even if frontend initialization hangs
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(5000)).await;
                if let Some(splash) = handle.get_webview_window("splashscreen") {
                    let _ = splash.close();
                }
                if let Some(main) = handle.get_webview_window("main") {
                    if !main.is_visible().unwrap_or(false) {
                        let _ = main.show();
                        let _ = main.set_focus();
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // When user closes window, minimize to macOS Status Bar instead of quitting
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            get_services,
            start_service,
            stop_service,
            restart_service,
            search_brew_packages,
            install_brew_package,
            uninstall_brew_package,
            get_installed_packages,
            get_outdated,
            upgrade_brew_package,
            get_system_metrics,
            trigger_notification,
            trigger_test_notification,
            get_brew_info
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
}
