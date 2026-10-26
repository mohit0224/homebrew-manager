import { invoke } from "@tauri-apps/api/core";
import { BrewService, SystemMetrics, BrewSystemInfo, AppUpdateInfo } from "../types/brew";
import { sanitizeAndValidatePackage, sanitizeAndValidateSearch } from "../validation/validation";

export const CURRENT_APP_VERSION = "0.1.0";
export const GITHUB_REPO = "mohit0224/homebrew-manager";
export const INSTALL_TERMINAL_COMMAND = `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/scripts/install.sh)"`;

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

function parseVersionParts(version: string): number[] {
  const cleaned = version.trim().replace(/^[vV]/, "").split("-")[0];
  return cleaned.split(".").map((p) => {
    const n = parseInt(p, 10);
    return Number.isNaN(n) ? 0 : n;
  });
}

export function isNewerSemver(current: string, latest: string): boolean {
  const currParts = parseVersionParts(current);
  const latestParts = parseVersionParts(latest);
  const len = Math.max(currParts.length, latestParts.length);
  for (let i = 0; i < len; i++) {
    const c = currParts[i] ?? 0;
    const l = latestParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
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

  async checkAppUpdate(): Promise<AppUpdateInfo> {
    const defaultInfo: AppUpdateInfo = {
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      updateAvailable: false,
      downloadUrl: `https://github.com/${GITHUB_REPO}/releases/latest/download/HomeBrew.Manager.dmg`,
      releaseNotes: "You are running the latest version of HomeBrew Manager.",
      publishedAt: null,
      htmlUrl: `https://github.com/${GITHUB_REPO}/releases`,
    };

    if (isTauriEnvironment()) {
      try {
        const res = await invoke<any>("check_app_update");
        return {
          currentVersion: res?.currentVersion || res?.current_version || CURRENT_APP_VERSION,
          latestVersion: res?.latestVersion || res?.latest_version || CURRENT_APP_VERSION,
          updateAvailable: Boolean(res?.updateAvailable ?? res?.update_available),
          downloadUrl:
            res?.downloadUrl ||
            res?.download_url ||
            defaultInfo.downloadUrl,
          releaseNotes:
            res?.releaseNotes ||
            res?.release_notes ||
            defaultInfo.releaseNotes,
          publishedAt: res?.publishedAt || res?.published_at || null,
          htmlUrl: res?.htmlUrl || res?.html_url || defaultInfo.htmlUrl,
        };
      } catch (_err) {
        // Fall through to browser fetch if command is not registered yet
      }
    }

    try {
      const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!resp.ok) {
        return defaultInfo;
      }
      const data = await resp.json();
      const rawTag = typeof data?.tag_name === "string" ? data.tag_name.trim() : CURRENT_APP_VERSION;
      const latestVersion = rawTag.replace(/^[vV]/, "");
      let downloadUrl = defaultInfo.downloadUrl;
      if (Array.isArray(data?.assets)) {
        const dmgAsset = data.assets.find(
          (a: any) => typeof a?.name === "string" && a.name.toLowerCase().endsWith(".dmg"),
        );
        if (dmgAsset?.browser_download_url) {
          downloadUrl = dmgAsset.browser_download_url;
        }
      }
      return {
        currentVersion: CURRENT_APP_VERSION,
        latestVersion,
        updateAvailable: isNewerSemver(CURRENT_APP_VERSION, latestVersion),
        downloadUrl,
        releaseNotes:
          typeof data?.body === "string" && data.body.trim().length > 0
            ? data.body
            : "New update available with performance improvements and features.",
        publishedAt: data?.published_at || null,
        htmlUrl: data?.html_url || defaultInfo.htmlUrl,
      };
    } catch (_e) {
      return defaultInfo;
    }
  },

  async installAppUpdate(downloadUrl?: string): Promise<CommandOutput> {
    return await safeInvoke<CommandOutput>("install_app_update", {
      downloadUrl: downloadUrl || null,
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
