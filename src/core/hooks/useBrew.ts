import { useState, useEffect, useCallback, useRef } from "react";
import { BrewService, SystemMetrics, MetricThresholdConfig, CommandLogEntry, BrewSystemInfo, isServiceRunning } from "../types/brew";
import { brewApi, SearchResultItem, OutdatedItem } from "../api/brewApi";

const DEFAULT_THRESHOLDS: MetricThresholdConfig = {
  cpuThresholdPercent: 80,
  ramThresholdMb: 1024,
  notificationsEnabled: true,
  cooldownSeconds: 60,
};

const THRESHOLDS_STORAGE_KEY = "homebrew_manager_thresholds";

function getInitialThresholds(): MetricThresholdConfig {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_THRESHOLDS;
  }
  try {
    const raw = localStorage.getItem(THRESHOLDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        cpuThresholdPercent:
          typeof parsed.cpuThresholdPercent === "number"
            ? parsed.cpuThresholdPercent
            : DEFAULT_THRESHOLDS.cpuThresholdPercent,
        ramThresholdMb:
          typeof parsed.ramThresholdMb === "number"
            ? parsed.ramThresholdMb
            : DEFAULT_THRESHOLDS.ramThresholdMb,
        notificationsEnabled:
          typeof parsed.notificationsEnabled === "boolean"
            ? parsed.notificationsEnabled
            : DEFAULT_THRESHOLDS.notificationsEnabled,
        cooldownSeconds:
          typeof parsed.cooldownSeconds === "number"
            ? parsed.cooldownSeconds
            : DEFAULT_THRESHOLDS.cooldownSeconds,
      };
    }
  } catch (err) {
    console.error("Failed to parse thresholds from localStorage:", err);
  }
  return DEFAULT_THRESHOLDS;
}

export const STATS_STORAGE_KEY = "homebrew_manager_stats";

export interface PersistedStats {
  installedPackages: number;
  availableUpdates: number;
  activeOperations: number;
}

function getInitialStats(): PersistedStats {
  if (typeof window === "undefined" || !window.localStorage) {
    return { installedPackages: 0, availableUpdates: 0, activeOperations: 0 };
  }
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        installedPackages: typeof parsed.installedPackages === "number" ? parsed.installedPackages : 0,
        availableUpdates: typeof parsed.availableUpdates === "number" ? parsed.availableUpdates : 0,
        activeOperations: typeof parsed.activeOperations === "number" ? parsed.activeOperations : 0,
      };
    }
  } catch (err) {
    console.error("Failed to parse stats from localStorage:", err);
  }
  return { installedPackages: 0, availableUpdates: 0, activeOperations: 0 };
}

export type ServiceActionType = "start" | "stop" | "restart" | "install" | "upgrade" | "uninstall";

export function useBrew() {
  const [services, setServices] = useState<BrewService[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpuUsagePercent: 0,
    memoryUsedMb: 0,
    memoryTotalMb: 0,
    activeServicesCount: 0,
  });
  const [brewInfo, setBrewInfo] = useState<BrewSystemInfo>({
    version: "Homebrew",
    prefix: "/opt/homebrew",
    isActive: true,
  });
  const [activeTab, setActiveTab] = useState<"home" | "installed" | "active" | "search" | "outdated" | "logs" | "settings">("home");
  const [selectedService, setSelectedService] = useState<BrewService | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Outdated / Upgrades state
  const [outdated, setOutdated] = useState<OutdatedItem[]>([]);
  const [isOutdatedLoading, setIsOutdatedLoading] = useState(false);

  // Action loading state
  const [runningActions, setRunningActions] = useState<Record<string, ServiceActionType | boolean>>({});
  const [isRefreshingServices, setIsRefreshingServices] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<CommandLogEntry[]>([]);

  // Thresholds state with localStorage persistence
  const [thresholds, setThresholdsState] = useState<MetricThresholdConfig>(getInitialThresholds);
  const lastAlertTimes = useRef<Record<string, number>>({});

  // 3 Primary Metrics State with localStorage persistence
  const [stats, setStats] = useState<PersistedStats>(getInitialStats);
  const hasLoadedServices = useRef(false);
  const hasLoadedOutdated = useRef(false);

  // Synchronize stats to localStorage in real time
  useEffect(() => {
    if (!hasLoadedServices.current && !hasLoadedOutdated.current && services.length === 0 && outdated.length === 0) {
      return;
    }

    const activeCount = services.filter((s) => isServiceRunning(s.status)).length;
    const initial = getInitialStats();
    const nextStats: PersistedStats = {
      installedPackages: hasLoadedServices.current || services.length > 0 ? services.length : initial.installedPackages,
      availableUpdates: hasLoadedOutdated.current || outdated.length > 0 ? outdated.length : initial.availableUpdates,
      activeOperations: hasLoadedServices.current || services.length > 0 ? activeCount : initial.activeOperations,
    };
    setStats(nextStats);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(nextStats));
      }
    } catch (err) {
      console.error("Failed to save stats to localStorage", err);
    }
  }, [services, outdated]);

  const setThresholds = useCallback(
    (action: MetricThresholdConfig | ((prev: MetricThresholdConfig) => MetricThresholdConfig)) => {
      setThresholdsState((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(next));
          }
        } catch (err) {
          console.error("Failed to save thresholds to localStorage:", err);
        }
        return next;
      });
    },
    [],
  );

  const addLog = useCallback((type: CommandLogEntry["type"], text: string) => {
    const entry: CommandLogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      type,
      text,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 199)]);
  }, []);

  // Fetch Services & Metrics
  const refreshServices = useCallback(async (isManual?: boolean | unknown) => {
    const isManualTrigger = isManual === true;
    setIsRefreshingServices(true);
    if (isManualTrigger) {
      addLog("info", "Refreshing Homebrew environment & services...");
    }
    try {
      const data = await brewApi.getServices();
      hasLoadedServices.current = true;
      setServices(data);

      const metrics = await brewApi.getSystemMetrics();
      const activeCount = data.filter((s) => isServiceRunning(s.status)).length;
      setSystemMetrics({
        ...metrics,
        activeServicesCount: activeCount,
      });

      try {
        const info = await brewApi.getBrewInfo();
        setBrewInfo(info);
      } catch (_e) {
        // Fallback silently if info fails
      }

      if (isManualTrigger) {
        addLog(
          "success",
          `Environment refresh complete: ${data.length} package(s)/service(s) detected (${activeCount} active).`
        );
      }

      // Spike Detection & Notification
      if (thresholds.notificationsEnabled) {
        const now = Date.now();
        for (const s of data) {
          if (isServiceRunning(s.status)) {
            const cpu = typeof s.cpu === "number" ? s.cpu : 0;
            const ram = typeof s.memory === "number" ? s.memory : 0;
            const lastAlert = lastAlertTimes.current[s.name] || 0;
            const cooldownPassed = now - lastAlert > thresholds.cooldownSeconds * 1000;

            if (cooldownPassed) {
              if (cpu >= thresholds.cpuThresholdPercent) {
                lastAlertTimes.current[s.name] = now;
                brewApi.notify(
                  "High CPU Spike Alert",
                  `Service "${s.name}" is using ${cpu.toFixed(1)}% CPU (Limit: ${thresholds.cpuThresholdPercent}%)`
                );
                addLog("stderr", `Resource Alert: ${s.name} high CPU spike (${cpu.toFixed(1)}%)`);
              } else if (ram >= thresholds.ramThresholdMb) {
                lastAlertTimes.current[s.name] = now;
                brewApi.notify(
                  "High Memory Spike Alert",
                  `Service "${s.name}" is using ${ram} MB RAM (Limit: ${thresholds.ramThresholdMb} MB)`
                );
                addLog("stderr", `Resource Alert: ${s.name} high Memory spike (${ram} MB)`);
              }
            }
          }
        }
      }
    } catch (err: any) {
      addLog("error", `Failed to refresh services: ${err?.message || err}`);
    } finally {
      setIsRefreshingServices(false);
    }
  }, [thresholds, addLog]);

  // Load Outdated Packages
  const refreshOutdated = useCallback(async (forceRefresh?: boolean | unknown) => {
    const isForce = forceRefresh === true;
    setIsOutdatedLoading(true);
    if (isForce) {
      addLog("info", "Checking for outdated packages and available updates...");
    }
    try {
      const items = await brewApi.getOutdated(isForce);
      hasLoadedOutdated.current = true;
      setOutdated(items);
      if (isForce) {
        if (items.length === 0) {
          addLog("success", "Update check complete: All Homebrew packages are up to date! (0 updates pending)");
        } else {
          addLog("success", `Update check complete: Found ${items.length} package(s) with available updates.`);
          items.forEach((item) => {
            const installedStr = item.installed_versions?.length
              ? item.installed_versions.join(", ")
              : "current";
            addLog("info", `  • ${item.name} (${installedStr} -> ${item.current_version})`);
          });
        }
      }
    } catch (err: any) {
      addLog("error", `Failed to check outdated packages: ${err?.message || err}`);
    } finally {
      setIsOutdatedLoading(false);
    }
  }, [addLog]);

  // Initial bootloader & polling loop
  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();

    const bootApp = async () => {
      // 1. Initial boot: fetch services, system metrics, and outdated packages concurrently
      await Promise.allSettled([refreshServices(), refreshOutdated(false)]);

      // Ensure loader completes at least one full smooth animation cycle (2000ms)
      const elapsed = Date.now() - startTime;
      const minLifecycleDuration = 2000;
      const remainingTime = Math.max(0, minLifecycleDuration - elapsed);

      setTimeout(async () => {
        if (!isMounted) return;
        await brewApi.closeSplashScreen();
      }, remainingTime);
    };

    bootApp();

    // Dynamic polling: poll every 1500ms when inspecting a service modal, otherwise 3000ms
    const pollInterval = selectedService ? 1500 : 3000;
    const interval = setInterval(refreshServices, pollInterval);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshServices, refreshOutdated, selectedService]);

  // Service Actions
  const handleStart = async (name: string) => {
    setRunningActions((prev) => ({ ...prev, [name]: "start" }));
    // Optimistic real-time UI update (+1 active)
    setServices((prev) =>
      prev.map((s) => (s.name === name ? { ...s, status: "started" } : s)),
    );
    addLog("info", `Starting service: ${name}...`);
    try {
      const res = await brewApi.startService(name);
      if (res.success) {
        addLog("success", `Successfully started: ${name}`);
      } else {
        addLog("stderr", `Error starting ${name}: ${res.stderr || res.stdout}`);
      }
      await refreshServices();
    } catch (err: any) {
      addLog("error", `Failed to start ${name}: ${err?.message || err}`);
      await refreshServices();
    } finally {
      setRunningActions((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleStop = async (name: string) => {
    setRunningActions((prev) => ({ ...prev, [name]: "stop" }));
    // Optimistic real-time UI update (-1 active immediately)
    setServices((prev) =>
      prev.map((s) =>
        s.name === name
          ? { ...s, status: "stopped", pid: undefined, cpu: null, memory: null }
          : s,
      ),
    );
    addLog("info", `Stopping service: ${name}...`);
    try {
      const res = await brewApi.stopService(name);
      if (res.success) {
        addLog("success", `Successfully stopped: ${name}`);
      } else {
        addLog("stderr", `Error stopping ${name}: ${res.stderr || res.stdout}`);
      }
      await refreshServices();
    } catch (err: any) {
      addLog("error", `Failed to stop ${name}: ${err?.message || err}`);
      await refreshServices();
    } finally {
      setRunningActions((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleRestart = async (name: string) => {
    setRunningActions((prev) => ({ ...prev, [name]: "restart" }));
    addLog("info", `Restarting service: ${name}...`);
    try {
      const res = await brewApi.restartService(name);
      if (res.success) {
        addLog("success", `Successfully restarted: ${name}`);
      } else {
        addLog("stderr", `Error restarting ${name}: ${res.stderr || res.stdout}`);
      }
      await refreshServices();
    } catch (err: any) {
      addLog("error", `Failed to restart ${name}: ${err?.message || err}`);
    } finally {
      setRunningActions((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Search Packages
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    addLog("info", `Searching Homebrew packages for "${trimmed}"...`);
    try {
      const results = await brewApi.searchPackages(trimmed);
      setSearchResults(results);
      addLog("success", `Search completed: Found ${results.length} package(s) matching "${trimmed}".`);
    } catch (err: any) {
      const msg = err?.message || "Search failed";
      setSearchError(msg);
      setSearchResults([]);
      addLog("error", `Search failed for "${trimmed}": ${msg}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Install Package
  const handleInstall = async (name: string) => {
    setRunningActions((prev) => ({ ...prev, [name]: "install" }));
    addLog("info", `Installing package: ${name}... (this may take a moment)`);
    try {
      const res = await brewApi.installPackage(name);
      if (res.stdout && res.stdout.trim().length > 0) {
        addLog("stdout", res.stdout.trim());
      }
      if (res.success) {
        hasLoadedServices.current = true;
        addLog("success", `Successfully installed: ${name}`);
        brewApi.notify("Package Installed", `${name} is now installed on your system.`);
        // Optimistic update of installed packages
        setServices((prev) => {
          if (!prev.some((p) => p.name === name)) {
            return [
              ...prev,
              {
                name,
                status: "stopped",
                user: undefined,
                file: undefined,
                pid: undefined,
                cpu: null,
                memory: null,
              },
            ];
          }
          return prev;
        });
        setSearchResults((prev) =>
          prev.map((item) =>
            item.name === name ? { ...item, is_installed: true } : item,
          ),
        );
      } else {
        addLog("stderr", `Install error for ${name}: ${res.stderr || res.stdout}`);
      }
      await refreshServices();
    } catch (err: any) {
      addLog("error", `Failed to install ${name}: ${err?.message || err}`);
    } finally {
      setRunningActions((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Uninstall Package
  const handleUninstall = async (name: string) => {
    setRunningActions((prev) => ({ ...prev, [name]: "uninstall" }));
    addLog("info", `Uninstalling package: ${name}... (this may take a moment)`);
    try {
      const res = await brewApi.uninstallPackage(name);
      if (res.stdout && res.stdout.trim().length > 0) {
        addLog("stdout", res.stdout.trim());
      }
      if (res.success) {
        hasLoadedServices.current = true;
        addLog("success", `Successfully uninstalled: ${name}`);
        brewApi.notify("Package Uninstalled", `${name} has been removed from your system.`);
        setSelectedService((prev) => (prev?.name === name ? null : prev));
        setServices((prev) => prev.filter((p) => p.name !== name));
        setOutdated((prev) => prev.filter((item) => item.name !== name));
        setSearchResults((prev) =>
          prev.map((item) =>
            item.name === name ? { ...item, is_installed: false } : item,
          ),
        );
      } else {
        addLog("stderr", `Uninstall error for ${name}: ${res.stderr || res.stdout}`);
      }
      await refreshServices();
      await refreshOutdated(true);
    } catch (err: any) {
      addLog("error", `Failed to uninstall ${name}: ${err?.message || err}`);
    } finally {
      setRunningActions((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Upgrade Package
  const handleUpgrade = async (name?: string) => {
    const target = typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
    const displayName = target || "all outdated packages";
    const key = target || "all";
    setRunningActions((prev) => ({ ...prev, [key]: "upgrade" }));
    addLog("info", `Starting upgrade for ${displayName}...`);
    try {
      const res = await brewApi.upgradePackage(target || undefined);
      if (res.stdout && res.stdout.trim().length > 0) {
        addLog("stdout", res.stdout.trim());
      }
      if (res.success) {
        hasLoadedOutdated.current = true;
        addLog("success", `Successfully upgraded: ${displayName}`);
        brewApi.notify("Upgrade Complete", `${displayName} upgraded successfully.`);
        // Optimistic update of outdated list
        if (target) {
          setOutdated((prev) => prev.filter((item) => item.name !== target));
        } else {
          setOutdated([]);
        }
      } else {
        addLog("stderr", `Upgrade error for ${displayName}: ${res.stderr || res.stdout}`);
      }
      await refreshOutdated(true);
      await refreshServices();
    } catch (err: any) {
      addLog("error", `Failed to upgrade ${displayName}: ${err?.message || err}`);
    } finally {
      setRunningActions((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  return {
    services,
    systemMetrics,
    brewInfo,
    clearSearch: () => {
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);
    },
    activeTab,
    setActiveTab,
    selectedService,
    setSelectedService,
    searchQuery,
    searchResults,
    isSearching,
    searchError,
    handleSearch,
    handleInstall,
    handleUninstall,
    outdated,
    isOutdatedLoading,
    refreshOutdated,
    handleUpgrade,
    handleStart,
    handleStop,
    handleRestart,
    runningActions,
    isRefreshingServices,
    logs,
    addLog,
    thresholds,
    setThresholds,
    refreshServices,
    stats,
  };
}
