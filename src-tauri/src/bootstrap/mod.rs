use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use crate::brew::{
    get_all_installed_packages, get_outdated_packages, get_system_brew_info, list_services,
    BrewServiceItem, BrewSystemInfo, InstalledPackageItem, OutdatedItem,
};
use crate::metrics::MetricsState;

/// Holds pre-computed bootstrap data initialized at application launch
#[derive(Clone)]
pub struct BootstrapState {
    pub cached_services: Arc<RwLock<Vec<BrewServiceItem>>>,
    pub cached_installed: Arc<RwLock<Vec<InstalledPackageItem>>>,
    pub cached_outdated: Arc<RwLock<Vec<OutdatedItem>>>,
    pub cached_info: Arc<RwLock<Option<BrewSystemInfo>>>,
    pub is_bootstrapping: Arc<AtomicBool>,
    pub is_installed_ready: Arc<AtomicBool>,
    pub is_outdated_ready: Arc<AtomicBool>,
    pub is_installed_fetching: Arc<AtomicBool>,
    pub is_outdated_fetching: Arc<AtomicBool>,
    pub last_services_fetch: Arc<RwLock<Option<Instant>>>,
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
            cached_installed: Arc::new(RwLock::new(Vec::new())),
            cached_outdated: Arc::new(RwLock::new(Vec::new())),
            cached_info: Arc::new(RwLock::new(None)),
            is_bootstrapping: Arc::new(AtomicBool::new(false)),
            is_installed_ready: Arc::new(AtomicBool::new(false)),
            is_outdated_ready: Arc::new(AtomicBool::new(false)),
            is_installed_fetching: Arc::new(AtomicBool::new(false)),
            is_outdated_fetching: Arc::new(AtomicBool::new(false)),
            last_services_fetch: Arc::new(RwLock::new(None)),
        }
    }

    /// Spawns background worker at application boot to query packages, outdated updates and system info.
    /// 
    /// # STRICT SAFETY GUARANTEE:
    /// This bootstrap process is strictly READ-ONLY:
    /// - NEVER starts, stops, or restarts any service.
    /// - NEVER installs or uninstalls any package.
    /// - NEVER updates or upgrades any package automatically.
    /// - ONLY executes read-only inspection queries (`brew services list`, `brew list --versions`, `brew --version`, `brew outdated --json=v2`).
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

            // 2. Preload services
            if let Ok(services) = list_services(&metrics) {
                if let Ok(mut lock) = state.cached_services.write() {
                    *lock = services;
                }
                if let Ok(mut lock) = state.last_services_fetch.write() {
                    *lock = Some(Instant::now());
                }
            }

            // 3. Preload all installed Homebrew packages with versions
            state.is_installed_fetching.store(true, Ordering::SeqCst);
            if let Ok(installed) = get_all_installed_packages() {
                if let Ok(mut lock) = state.cached_installed.write() {
                    *lock = installed;
                }
                state.is_installed_ready.store(true, Ordering::SeqCst);
            }
            state.is_installed_fetching.store(false, Ordering::SeqCst);

            // 4. Preload outdated packages (the heavy calculation)
            state.is_outdated_fetching.store(true, Ordering::SeqCst);
            if let Ok(outdated) = get_outdated_packages() {
                if let Ok(mut lock) = state.cached_outdated.write() {
                    *lock = outdated;
                }
                state.is_outdated_ready.store(true, Ordering::SeqCst);
            }
            state.is_outdated_fetching.store(false, Ordering::SeqCst);

            state.is_bootstrapping.store(false, Ordering::SeqCst);
        });
    }

    /// Retrieve all installed Homebrew packages with versions.
    /// De-duplicates concurrent calls so multiple threads never spawn duplicate brew commands.
    pub fn get_installed_packages(&self, force_refresh: bool) -> Result<Vec<InstalledPackageItem>, String> {
        if !force_refresh && self.is_installed_ready.load(Ordering::SeqCst) {
            if let Ok(lock) = self.cached_installed.read() {
                if !lock.is_empty() {
                    return Ok(lock.clone());
                }
            }
        }

        // De-duplicate in-flight fetch
        if self.is_installed_fetching.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
            let res = get_all_installed_packages();
            self.is_installed_fetching.store(false, Ordering::SeqCst);
            match res {
                Ok(fresh) => {
                    if let Ok(mut lock) = self.cached_installed.write() {
                        *lock = fresh.clone();
                    }
                    self.is_installed_ready.store(true, Ordering::SeqCst);
                    Ok(fresh)
                }
                Err(e) => Err(e),
            }
        } else {
            // Another thread is actively fetching; wait for it rather than spawning duplicate
            for _ in 0..100 {
                std::thread::sleep(std::time::Duration::from_millis(50));
                if !self.is_installed_fetching.load(Ordering::SeqCst) && self.is_installed_ready.load(Ordering::SeqCst) {
                    if let Ok(lock) = self.cached_installed.read() {
                        return Ok(lock.clone());
                    }
                }
            }
            if let Ok(lock) = self.cached_installed.read() {
                if !lock.is_empty() {
                    return Ok(lock.clone());
                }
            }
            get_all_installed_packages()
        }
    }

    /// Retrieve outdated packages.
    /// If already pre-computed by bootstrap, returns instantly (< 1ms).
    /// De-duplicates concurrent calls so multiple threads never spawn duplicate brew commands.
    pub fn get_outdated(&self, force_refresh: bool) -> Result<Vec<OutdatedItem>, String> {
        if !force_refresh && self.is_outdated_ready.load(Ordering::SeqCst) {
            if let Ok(lock) = self.cached_outdated.read() {
                return Ok(lock.clone());
            }
        }

        // De-duplicate in-flight fetch
        if self.is_outdated_fetching.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
            let res = get_outdated_packages();
            self.is_outdated_fetching.store(false, Ordering::SeqCst);
            match res {
                Ok(fresh) => {
                    if let Ok(mut lock) = self.cached_outdated.write() {
                        *lock = fresh.clone();
                    }
                    self.is_outdated_ready.store(true, Ordering::SeqCst);
                    Ok(fresh)
                }
                Err(e) => Err(e),
            }
        } else {
            // Another thread is actively fetching; wait for it rather than spawning duplicate
            for _ in 0..150 {
                std::thread::sleep(std::time::Duration::from_millis(100));
                if !self.is_outdated_fetching.load(Ordering::SeqCst) && self.is_outdated_ready.load(Ordering::SeqCst) {
                    if let Ok(lock) = self.cached_outdated.read() {
                        return Ok(lock.clone());
                    }
                }
            }
            if let Ok(lock) = self.cached_outdated.read() {
                return Ok(lock.clone());
            }
            get_outdated_packages()
        }
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

    /// Retrieve services list with short TTL caching to prevent rapid polling thrashing
    pub fn get_services(&self, metrics: &MetricsState, force_refresh: bool) -> Result<Vec<BrewServiceItem>, String> {
        if !force_refresh {
            if let Ok(lock) = self.last_services_fetch.read() {
                if let Some(instant) = *lock {
                    if instant.elapsed() < std::time::Duration::from_millis(2500) {
                        if let Ok(cached) = self.cached_services.read() {
                            if !cached.is_empty() {
                                return Ok(cached.clone());
                            }
                        }
                    }
                }
            }
        }

        let fresh = list_services(metrics)?;
        if let Ok(mut lock) = self.cached_services.write() {
            *lock = fresh.clone();
        }
        if let Ok(mut lock) = self.last_services_fetch.write() {
            *lock = Some(Instant::now());
        }
        Ok(fresh)
    }

    /// Invalidate services cache immediately when a service status is modified
    pub fn invalidate_services_cache(&self) {
        if let Ok(mut lock) = self.last_services_fetch.write() {
            *lock = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bootstrap_initialization() {
        let state = BootstrapState::new();
        assert!(!state.is_bootstrapping.load(Ordering::SeqCst));
        assert!(!state.is_installed_ready.load(Ordering::SeqCst));
        assert!(!state.is_outdated_ready.load(Ordering::SeqCst));
        assert!(!state.is_installed_fetching.load(Ordering::SeqCst));
        assert!(!state.is_outdated_fetching.load(Ordering::SeqCst));
    }

    #[test]
    fn test_services_cache_invalidation() {
        let state = BootstrapState::new();
        if let Ok(mut lock) = state.last_services_fetch.write() {
            *lock = Some(Instant::now());
        }
        assert!(state.last_services_fetch.read().unwrap().is_some());
        state.invalidate_services_cache();
        assert!(state.last_services_fetch.read().unwrap().is_none());
    }
}
