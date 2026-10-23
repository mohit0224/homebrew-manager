import { invoke } from "@tauri-apps/api/core";
import { BrewService, SystemMetrics, BrewSystemInfo } from "../types/brew";
import { sanitizeAndValidatePackage, sanitizeAndValidateSearch } from "../validation/validation";

export interface CommandOutput {
  success: boolean;
  stdout: string;
  stderr: string;
}

export interface SearchResultItem {
  name: string;
  description?: string;
  version?: string;
  is_installed: boolean;
}

export interface OutdatedItem {
  name: string;
  installed_versions: string[];
  current_version: string;
  installedVersions?: string[];
  currentVersion?: string;
}

export interface InstalledPackageItem {
  name: string;
  installed_versions: string[];
  installedVersions?: string[];
}

export function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).__TAURI_INTERNALS__ !== "undefined" &&
    typeof (window as any).__TAURI_INTERNALS__.invoke === "function"
  );
}

async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  if (!isTauriEnvironment()) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error("Tauri native runtime is not available in browser preview.");
  }
  return await invoke<T>(cmd, args);
}

function normalizeOutdatedItem(raw: any): OutdatedItem {
  const installed = Array.isArray(raw?.installed_versions)
    ? raw.installed_versions
    : Array.isArray(raw?.installedVersions)
      ? raw.installedVersions
      : [];
  const current =
    typeof raw?.current_version === "string" && raw.current_version.length > 0
      ? raw.current_version
      : typeof raw?.currentVersion === "string" && raw.currentVersion.length > 0
        ? raw.currentVersion
        : "latest";

  return {
    name: String(raw?.name || ""),
    installed_versions: installed,
    installedVersions: installed,
    current_version: current,
    currentVersion: current,
  };
}

function normalizeInstalledItem(raw: any): InstalledPackageItem {
  const installed = Array.isArray(raw?.installed_versions)
    ? raw.installed_versions
    : Array.isArray(raw?.installedVersions)
      ? raw.installedVersions
      : [];

  return {
    name: String(raw?.name || ""),
    installed_versions: installed,
    installedVersions: installed,
  };
}

export const brewApi = {
  async getServices(): Promise<BrewService[]> {
    return await safeInvoke<BrewService[]>("get_services", undefined, []);
  },

  async startService(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await safeInvoke<CommandOutput>("start_service", { name: val.sanitized });
  },

  async stopService(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await safeInvoke<CommandOutput>("stop_service", { name: val.sanitized });
  },

  async restartService(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await safeInvoke<CommandOutput>("restart_service", { name: val.sanitized });
  },

  async searchPackages(query: string): Promise<SearchResultItem[]> {
    const val = sanitizeAndValidateSearch(query);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await safeInvoke<SearchResultItem[]>(
      "search_brew_packages",
      { query: val.sanitized },
      [],
    );
  },

  async installPackage(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await safeInvoke<CommandOutput>("install_brew_package", { name: val.sanitized });
  },

  async uninstallPackage(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await safeInvoke<CommandOutput>("uninstall_brew_package", { name: val.sanitized });
  },

  async getInstalledPackages(forceRefresh: boolean = false): Promise<InstalledPackageItem[]> {
    const rawList = await safeInvoke<any[]>(
      "get_installed_packages",
      { forceRefresh: forceRefresh === true },
      [],
    );
    return Array.isArray(rawList) ? rawList.map(normalizeInstalledItem) : [];
  },

  async getOutdated(forceRefresh: boolean = false): Promise<OutdatedItem[]> {
    const rawList = await safeInvoke<any[]>(
      "get_outdated",
      { forceRefresh: forceRefresh === true },
      [],
    );
    return Array.isArray(rawList) ? rawList.map(normalizeOutdatedItem) : [];
  },

  async upgradePackage(name?: string): Promise<CommandOutput> {
    if (typeof name === "string" && name.trim().length > 0) {
      const val = sanitizeAndValidatePackage(name);
      if (!val.isValid) {
        throw new Error(val.error);
      }
      return await safeInvoke<CommandOutput>("upgrade_brew_package", { name: val.sanitized });
    }
    return await safeInvoke<CommandOutput>("upgrade_brew_package", { name: null });
  },

  async getSystemMetrics(): Promise<SystemMetrics> {
    const raw = await safeInvoke<{
      cpu_usage_percent: number;
      memory_used_mb: number;
      memory_total_mb: number;
    }>("get_system_metrics", undefined, {
      cpu_usage_percent: 0,
      memory_used_mb: 0,
      memory_total_mb: 0,
    });

    return {
      cpuUsagePercent: Math.round((raw?.cpu_usage_percent || 0) * 10) / 10,
      memoryUsedMb: raw?.memory_used_mb || 0,
      memoryTotalMb: raw?.memory_total_mb || 0,
      activeServicesCount: 0,
    };
  },

  async notify(title: string, body: string): Promise<void> {
    if (!isTauriEnvironment()) return;
    await safeInvoke("trigger_notification", { title, body });
  },

  async notifyTest(title: string, body: string): Promise<void> {
    if (!isTauriEnvironment()) return;
    await safeInvoke("trigger_test_notification", { title, body });
  },

  async getBrewInfo(): Promise<BrewSystemInfo> {
    return await safeInvoke<BrewSystemInfo>("get_brew_info", undefined, {
      version: "Homebrew",
      prefix: "/opt/homebrew",
      isActive: true,
    });
  },

  async closeSplashScreen(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await safeInvoke("close_splashscreen");
    } catch (_e) {
      // Ignore if outside Tauri environment
    }
  },
};
