use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicBool, Ordering};
use crate::brew::{
    get_outdated_packages, get_system_brew_info, list_services,
    BrewServiceItem, BrewSystemInfo, OutdatedItem,
};
use crate::metrics::MetricsState;

/// Holds pre-computed bootstrap data initialized at application launch
#[derive(Clone)]
pub struct BootstrapState {
    pub cached_services: Arc<RwLock<Vec<BrewServiceItem>>>,
    pub cached_outdated: Arc<RwLock<Vec<OutdatedItem>>>,
    pub cached_info: Arc<RwLock<Option<BrewSystemInfo>>>,
    pub is_bootstrapping: Arc<AtomicBool>,
    pub is_outdated_ready: Arc<AtomicBool>,
}

impl Default for BootstrapState {
    fn default() -> Self {
        Self::new()
    }
}

impl BootstrapState {
    pub fn new() -> Self {
        Self {
            cached_services: Arc::new(RwLock::new(Vec::new())),
            cached_outdated: Arc::new(RwLock::new(Vec::new())),
            cached_info: Arc::new(RwLock::new(None)),
            is_bootstrapping: Arc::new(AtomicBool::new(false)),
            is_outdated_ready: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Spawns background worker at application boot to query packages, outdated updates and system info.
    /// 
    /// # STRICT SAFETY GUARANTEE:
    /// This bootstrap process is strictly READ-ONLY:
    /// - NEVER starts, stops, or restarts any service.
    /// - NEVER installs or uninstalls any package.
    /// - NEVER updates or upgrades any package automatically.
    /// - ONLY executes read-only inspection queries (`brew services list`, `brew --version`, `brew outdated --json=v2`).
    pub fn start_bootstrap(&self, metrics: MetricsState) {
        let state = self.clone();
        std::thread::spawn(move || {
            state.is_bootstrapping.store(true, Ordering::SeqCst);

            // 1. Preload system brew info
            if let Ok(info) = get_system_brew_info() {
                if let Ok(mut lock) = state.cached_info.write() {
                    *lock = Some(info);
                }
            }

            // 2. Preload services and installed packages
            if let Ok(services) = list_services(&metrics) {
                if let Ok(mut lock) = state.cached_services.write() {
                    *lock = services;
                }
            }

            // 3. Preload outdated packages (the heavy calculation)
            if let Ok(outdated) = get_outdated_packages() {
                if let Ok(mut lock) = state.cached_outdated.write() {
                    *lock = outdated;
                }
                state.is_outdated_ready.store(true, Ordering::SeqCst);
            }

            state.is_bootstrapping.store(false, Ordering::SeqCst);
        });
    }

    /// Retrieve outdated packages.
    /// If already pre-computed by bootstrap, returns instantly (< 1ms).
    /// If force_refresh is true (e.g. user clicked "Check Updates"), re-runs check.
    pub fn get_outdated(&self, force_refresh: bool) -> Result<Vec<OutdatedItem>, String> {
        // Return instantly from bootstrap cache if ready and not a forced re-check
        if !force_refresh && self.is_outdated_ready.load(Ordering::SeqCst) {
            if let Ok(lock) = self.cached_outdated.read() {
                return Ok(lock.clone());
            }
        }

        // If app just booted and bootstrap thread is in-flight, give it a moment
        if !force_refresh && self.is_bootstrapping.load(Ordering::SeqCst) {
            for _ in 0..25 {
                std::thread::sleep(std::time::Duration::from_millis(100));
                if self.is_outdated_ready.load(Ordering::SeqCst) {
                    if let Ok(lock) = self.cached_outdated.read() {
                        return Ok(lock.clone());
                    }
                }
            }
        }

        // Fetch fresh outdated packages and update cache
        let fresh = get_outdated_packages()?;
        if let Ok(mut lock) = self.cached_outdated.write() {
            *lock = fresh.clone();
        }
        self.is_outdated_ready.store(true, Ordering::SeqCst);
        Ok(fresh)
    }

    /// Retrieve brew system info (instant if cached by bootstrap)
    pub fn get_brew_info(&self) -> Result<BrewSystemInfo, String> {
        if let Ok(lock) = self.cached_info.read() {
            if let Some(info) = lock.as_ref() {
                return Ok(info.clone());
            }
        }
        let fresh = get_system_brew_info()?;
        if let Ok(mut lock) = self.cached_info.write() {
            *lock = Some(fresh.clone());
        }
        Ok(fresh)
    }

    /// Retrieve services list and update cache
    pub fn get_services(&self, metrics: &MetricsState) -> Result<Vec<BrewServiceItem>, String> {
        let fresh = list_services(metrics)?;
        if let Ok(mut lock) = self.cached_services.write() {
            *lock = fresh.clone();
        }
        Ok(fresh)
    }
}
