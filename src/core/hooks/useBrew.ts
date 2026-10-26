import { useState, useEffect, useCallback, useRef } from "react";
import {
  BrewService,
  SystemMetrics,
  MetricThresholdConfig,
  CommandLogEntry,
  BrewSystemInfo,
  AppUpdateInfo,
  isServiceRunning,
} from "../types/brew";
import {
  brewApi,
  isTauriEnvironment,
  SearchResultItem,
  OutdatedItem,
  InstalledPackageItem,
  CURRENT_APP_VERSION,
  GITHUB_REPO,
} from "../api/brewApi";

const DEFAULT_THRESHOLDS: MetricThresholdConfig = {
  cpuThresholdPercent: 80,
  ramThresholdMb: 1024,
  notificationsEnabled: true,
  cooldownSeconds: 60,
};

const THRESHOLDS_STORAGE_KEY = "homebrew_manager_thresholds";
const INSTALLED_PACKAGES_STORAGE_KEY = "homebrew_manager_installed_packages";

const FALLBACK_INSTALLED_PACKAGES: InstalledPackageItem[] = [
  { name: "abseil", installed_versions: ["20260817.0"] },
  { name: "ada-url", installed_versions: ["4.0.0", "4.0.0_1"] },
  { name: "brotli", installed_versions: ["1.2.0"] },
  { name: "c-ares", installed_versions: ["1.34.8", "1.34.9"] },
  { name: "ca-certificates", installed_versions: ["2026-09-25", "2026-08-13", "2026-10-20"] },
  { name: "cloudflared", installed_versions: ["2026.10.3"] },
  { name: "dav1d", installed_versions: ["1.5.4"] },
  { name: "ffmpeg", installed_versions: ["9.0.2_1"] },
  { name: "fmt", installed_versions: ["12.2.0"] },
  { name: "hdrhistogram_c", installed_versions: ["0.12.0", "0.12.1"] },
  { name: "highway", installed_versions: ["1.4.0"] },
  { name: "icu4c@78", installed_versions: ["78.3"] },
  { name: "krb5", installed_versions: ["1.22.2_2"] },
  { name: "lame", installed_versions: ["4.0"] },
  { name: "libffi", installed_versions: ["3.8.0"] },
  { name: "libmagic", installed_versions: ["5.48"] },
  { name: "libnghttp2", installed_versions: ["1.70.0"] },
  { name: "libpq", installed_versions: ["18.6_1"] },
  { name: "libuv", installed_versions: ["1.53.0"] },
  { name: "libvmaf", installed_versions: ["3.2.1"] },
  { name: "libvpx", installed_versions: ["1.17.0"] },
  { name: "llhttp", installed_versions: ["9.4.3"] },
  { name: "lz4", installed_versions: ["1.10.0"] },
  { name: "merve", installed_versions: ["1.2.2_3", "1.2.2_4"] },
  { name: "mongodb-community", installed_versions: ["9.0.4", "8.3.11"] },
  { name: "mongodb-database-tools", installed_versions: ["100.14.1", "100.16.1"] },
  { name: "mongosh", installed_versions: ["2.13.0"] },
  { name: "mpg123", installed_versions: ["1.33.7"] },
  { name: "nbytes", installed_versions: ["0.1.4"] },
  { name: "node", installed_versions: ["26.12.0", "26.11.1_1"] },
  { name: "nvm", installed_versions: ["0.40.8"] },
  { name: "openssl@4", installed_versions: ["4.0.3"] },
  { name: "opus", installed_versions: ["1.6.1"] },
  { name: "readline", installed_versions: ["8.3.3", "8.3.6"] },
  { name: "redis", installed_versions: ["8.10.2_1"] },
  { name: "sdl2-compat", installed_versions: ["2.32.74"] },
  { name: "sdl3", installed_versions: ["3.4.18"] },
  { name: "simdjson", installed_versions: ["5.0.5", "5.0.3"] },
  { name: "simdutf", installed_versions: ["9.3.2", "9.2.1_1", "9.3.0"] },
  { name: "sqlite", installed_versions: ["3.54.1", "3.54.0", "3.51.2_1", "3.53.0"] },
  { name: "svt-av1", installed_versions: ["4.2.0"] },
  { name: "uvwasi", installed_versions: ["0.0.23"] },
  { name: "x264", installed_versions: ["r3222"] },
  { name: "x265", installed_versions: ["4.3"] },
  { name: "xz", installed_versions: ["5.8.2", "5.8.4"] },
  { name: "zstd", installed_versions: ["1.5.7_1"] },
];

function getInitialInstalledPackages(): InstalledPackageItem[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return FALLBACK_INSTALLED_PACKAGES;
  }
  try {
    const raw = localStorage.getItem(INSTALLED_PACKAGES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_err) {
    // Fallback to initial snapshot
  }
  return FALLBACK_INSTALLED_PACKAGES;
}

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
  const [installedPackages, setInstalledPackages] = useState<InstalledPackageItem[]>(getInitialInstalledPackages);
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

  // App Self-Update state
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo>({
    currentVersion: CURRENT_APP_VERSION,
    latestVersion: CURRENT_APP_VERSION,
    updateAvailable: false,
    downloadUrl: `https://github.com/${GITHUB_REPO}/releases/latest/download/HomeBrew.Manager.dmg`,
    releaseNotes: "You are running the latest version of HomeBrew Manager.",
    publishedAt: null,
    htmlUrl: `https://github.com/${GITHUB_REPO}/releases`,
  });
  const [isCheckingAppUpdate, setIsCheckingAppUpdate] = useState(false);
  const [isInstallingAppUpdate, setIsInstallingAppUpdate] = useState(false);
  const [appUpdateCheckedAt, setAppUpdateCheckedAt] = useState<string | null>(null);
  const hasNotifiedAppUpdateRef = useRef<string | null>(null);

  // Action loading state
  const [runningActions, setRunningActions] = useState<Record<string, ServiceActionType | boolean>>({});
  const runningActionsRef = useRef<Record<string, ServiceActionType | boolean>>({});
  runningActionsRef.current = runningActions;
  const isRefreshingRef = useRef(false);
  const [isRefreshingServices, setIsRefreshingServices] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<CommandLogEntry[]>([]);

  // Listen for real-time streaming output from long-running Homebrew operations
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<{ operation: string; target: string; stream: "stdout" | "stderr"; line: string }>(
        "brew-log-line",
        (event) => {
          const payload = event.payload;
          if (payload && payload.line && payload.line.trim().length > 0) {
            const entryType = payload.stream === "stderr" ? "stderr" : "stdout";
            const entry: CommandLogEntry = {
              id: Math.random().toString(36).substring(7),
              timestamp: new Date().toLocaleTimeString(),
              type: entryType,
              text: payload.line,
            };
            setLogs((prev) => [entry, ...prev.slice(0, 199)]);
          }
        },
      ).then((unsub) => {
        unlisten = unsub;
      });
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Thresholds state with localStorage persistence
  const [thresholds, setThresholdsState] = useState<MetricThresholdConfig>(getInitialThresholds);
  const lastAlertTimes = useRef<Record<string, number>>({});

  // 3 Primary Metrics State with localStorage persistence
  const [stats, setStats] = useState<PersistedStats>(getInitialStats);
  const hasLoadedServices = useRef(false);
  const hasLoadedOutdated = useRef(false);

  // Persist installedPackages to localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage && installedPackages.length > 0) {
        localStorage.setItem(INSTALLED_PACKAGES_STORAGE_KEY, JSON.stringify(installedPackages));
      }
    } catch (_err) {
      // Ignore storage errors
    }
  }, [installedPackages]);

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

  // Check for Application Release Update on GitHub
  const handleCheckAppUpdate = useCallback(
    async (isManual?: boolean) => {
      const manual = isManual === true;
      setIsCheckingAppUpdate(true);
      if (manual) {
        addLog("info", "Checking GitHub Releases for HomeBrew Manager updates...");
      }
      try {
        const info = await brewApi.checkAppUpdate();
        setAppUpdateInfo(info);
        setAppUpdateCheckedAt(new Date().toLocaleTimeString());

        if (info.updateAvailable) {
          addLog(
            "success",
            `App update available: v${info.latestVersion} (Current: v${info.currentVersion})`,
          );
          if (hasNotifiedAppUpdateRef.current !== info.latestVersion || manual) {
            hasNotifiedAppUpdateRef.current = info.latestVersion;
            brewApi.notify(
              "HomeBrew Manager Update Available",
              `Version v${info.latestVersion} is ready to install. Open Settings to update with 1 click.`,
            );
          }
        } else if (manual) {
          addLog(
            "success",
            `App update check complete: You are running the latest version (v${info.currentVersion}).`,
          );
        }
        return info;
      } catch (err: any) {
        if (manual) {
          addLog("error", `Failed to check for app updates: ${err?.message || err}`);
        }
        return null;
      } finally {
        setIsCheckingAppUpdate(false);
      }
    },
    [addLog],
  );

  // Install Application Update with macOS Quarantine Bypass
  const handleInstallAppUpdate = useCallback(async () => {
    setIsInstallingAppUpdate(true);
    addLog(
      "info",
      `Downloading HomeBrew Manager v${appUpdateInfo.latestVersion} DMG, clearing macOS quarantine flag, and installing to /Applications...`,
    );
    try {
      const res = await brewApi.installAppUpdate(appUpdateInfo.downloadUrl);
      if (res.stdout && res.stdout.trim().length > 0) {
        addLog("stdout", res.stdout.trim());
      }
      if (res.success) {
        addLog(
          "success",
          "Update installed and macOS quarantine flag removed! Relaunching HomeBrew Manager...",
        );
        brewApi.notify(
          "Update Installed",
          `HomeBrew Manager v${appUpdateInfo.latestVersion} has been installed. Restarting app...`,
        );
      } else {
        addLog("stderr", `App update failed: ${res.stderr || res.stdout}`);
      }
    } catch (err: any) {
      addLog("error", `App update error: ${err?.message || err}`);
    } finally {
      setIsInstallingAppUpdate(false);
    }
  }, [appUpdateInfo.downloadUrl, appUpdateInfo.latestVersion, addLog]);

  // Fetch Services & Metrics
  const refreshServices = useCallback(async (isManual?: boolean | unknown) => {
    const isManualTrigger = isManual === true;
    if (!isManualTrigger && Object.keys(runningActionsRef.current).length > 0) {
      return;
    }
    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;
    setIsRefreshingServices(true);
    if (isManualTrigger) {
      addLog("info", "Refreshing Homebrew environment & services...");
    }
    try {
      const data = await brewApi.getServices(isManualTrigger);
      hasLoadedServices.current = true;
      setServices(data);

      try {
        const allInstalled = await brewApi.getInstalledPackages(isManualTrigger);
        if (Array.isArray(allInstalled) && allInstalled.length > 0) {
          setInstalledPackages(allInstalled);
        }
      } catch (_e) {
        // Fallback silently if command not yet available in running binary
      }

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
      isRefreshingRef.current = false;
      setIsRefreshingServices(false);
    }
  }, [thresholds, addLog]);

  // Load Outdated & All Installed Packages
  const refreshOutdated = useCallback(async (forceRefresh?: boolean | unknown) => {
    const isForce = forceRefresh === true;
    setIsOutdatedLoading(true);
    if (isForce) {
      addLog("info", "Checking for outdated packages and available updates...");
    }
    try {
      const [outdatedRes, installedRes] = await Promise.allSettled([
        brewApi.getOutdated(isForce),
        brewApi.getInstalledPackages(isForce),
      ]);

      if (installedRes.status === "fulfilled" && Array.isArray(installedRes.value) && installedRes.value.length > 0) {
        setInstalledPackages(installedRes.value);
      }

      if (outdatedRes.status === "fulfilled") {
        const items = outdatedRes.value;
        hasLoadedOutdated.current = true;
        setOutdated(items);
        if (isForce) {
          if (items.length === 0) {
            addLog("success", "Update check complete: All Homebrew packages are up to date! (0 updates pending)");
          } else {
            addLog("success", `Update check complete: Found ${items.length} package(s) with available updates.`);
            items.forEach((item) => {
              const versions = item.installed_versions?.length
                ? item.installed_versions
                : item.installedVersions?.length
                  ? item.installedVersions
                  : [];
              const installedStr = versions.length > 0 ? versions.join(", ") : "current";
              const targetVersion = item.current_version || item.currentVersion || "latest";
              addLog("info", `  • ${item.name} (${installedStr} -> ${targetVersion})`);
            });
          }
        }
      } else {
        throw outdatedRes.reason;
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
      // 1. Initial boot: fetch services, system metrics, outdated packages, and check app updates concurrently
      await Promise.allSettled([
        refreshServices(),
        refreshOutdated(false),
        handleCheckAppUpdate(false),
      ]);

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

    // Dynamic polling: poll every 2000ms when inspecting a service modal, otherwise 5000ms
    const pollInterval = selectedService ? 2000 : 5000;
    const interval = setInterval(() => {
      refreshServices(false);
    }, pollInterval);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshServices, refreshOutdated, handleCheckAppUpdate, selectedService]);

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
      const installedSet = new Set<string>();
      installedPackages.forEach((p) => {
        installedSet.add(p.name.toLowerCase());
        const base = p.name.split("/").pop()?.toLowerCase();
        if (base) installedSet.add(base);
      });
      services.forEach((s) => {
        installedSet.add(s.name.toLowerCase());
        const base = s.name.split("/").pop()?.toLowerCase();
        if (base) installedSet.add(base);
      });
      const enrichedResults = results.map((pkg) => {
        const lower = pkg.name.toLowerCase();
        const base = lower.split("/").pop() || lower;
        const isInstalled = pkg.is_installed || installedSet.has(lower) || installedSet.has(base);
        return {
          ...pkg,
          is_installed: isInstalled,
        };
      });
      setSearchResults(enrichedResults);
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
    addLog("info", `Installing package: ${name}... (streaming output below)`);
    try {
      const res = await brewApi.installPackage(name);
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
        setInstalledPackages((prev) => {
          if (!prev.some((p) => p.name === name)) {
            return [...prev, { name, installed_versions: ["latest"] }];
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
      await refreshServices(true);
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
    addLog("info", `Uninstalling package: ${name}... (streaming output below)`);
    try {
      const res = await brewApi.uninstallPackage(name);
      if (res.success) {
        hasLoadedServices.current = true;
        addLog("success", `Successfully uninstalled: ${name}`);
        brewApi.notify("Package Uninstalled", `${name} has been removed from your system.`);
        setSelectedService((prev) => (prev?.name === name ? null : prev));
        setServices((prev) => prev.filter((p) => p.name !== name));
        setInstalledPackages((prev) => prev.filter((p) => p.name !== name));
        setOutdated((prev) => prev.filter((item) => item.name !== name));
        setSearchResults((prev) =>
          prev.map((item) =>
            item.name === name ? { ...item, is_installed: false } : item,
          ),
        );
      } else {
        addLog("stderr", `Uninstall error for ${name}: ${res.stderr || res.stdout}`);
      }
      await refreshServices(true);
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
    addLog("info", `Starting upgrade for ${displayName}... (streaming output below)`);
    try {
      const res = await brewApi.upgradePackage(target || undefined);
      if (res.success) {
        hasLoadedOutdated.current = true;
        addLog("success", `Successfully upgraded: ${displayName}`);
        brewApi.notify("Upgrade Complete", `${displayName} upgraded successfully.`);
        // Optimistic update of outdated list and installed package versions
        if (target) {
          const upgradedItem = outdated.find((item) => item.name === target);
          const nextVer = upgradedItem?.current_version || upgradedItem?.currentVersion;
          if (nextVer) {
            setInstalledPackages((prev) =>
              prev.map((p) =>
                p.name === target
                  ? { ...p, installed_versions: [nextVer], installedVersions: [nextVer] }
                  : p,
              ),
            );
          }
          setOutdated((prev) => prev.filter((item) => item.name !== target));
        } else {
          setInstalledPackages((prev) =>
            prev.map((p) => {
              const match = outdated.find((o) => o.name === p.name);
              const nextVer = match?.current_version || match?.currentVersion;
              return nextVer
                ? { ...p, installed_versions: [nextVer], installedVersions: [nextVer] }
                : p;
            }),
          );
          setOutdated([]);
        }
      } else {
        addLog("stderr", `Upgrade error for ${displayName}: ${res.stderr || res.stdout}`);
      }
      await refreshOutdated(true);
      await refreshServices(true);
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
    installedPackages,
    systemMetrics,
    brewInfo,
    appUpdateInfo,
    isCheckingAppUpdate,
    isInstallingAppUpdate,
    appUpdateCheckedAt,
    handleCheckAppUpdate,
    handleInstallAppUpdate,
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
