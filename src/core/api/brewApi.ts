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
}

export const brewApi = {
  async getServices(): Promise<BrewService[]> {
    return await invoke<BrewService[]>("get_services");
  },

  async startService(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await invoke<CommandOutput>("start_service", { name: val.sanitized });
  },

  async stopService(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await invoke<CommandOutput>("stop_service", { name: val.sanitized });
  },

  async restartService(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await invoke<CommandOutput>("restart_service", { name: val.sanitized });
  },

  async searchPackages(query: string): Promise<SearchResultItem[]> {
    const val = sanitizeAndValidateSearch(query);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await invoke<SearchResultItem[]>("search_brew_packages", { query: val.sanitized });
  },

  async installPackage(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await invoke<CommandOutput>("install_brew_package", { name: val.sanitized });
  },

  async uninstallPackage(name: string): Promise<CommandOutput> {
    const val = sanitizeAndValidatePackage(name);
    if (!val.isValid) {
      throw new Error(val.error);
    }
    return await invoke<CommandOutput>("uninstall_brew_package", { name: val.sanitized });
  },

  async getOutdated(forceRefresh: boolean = false): Promise<OutdatedItem[]> {
    return await invoke<OutdatedItem[]>("get_outdated", {
      forceRefresh: forceRefresh === true,
    });
  },

  async upgradePackage(name?: string): Promise<CommandOutput> {
    if (typeof name === "string" && name.trim().length > 0) {
      const val = sanitizeAndValidatePackage(name);
      if (!val.isValid) {
        throw new Error(val.error);
      }
      return await invoke<CommandOutput>("upgrade_brew_package", { name: val.sanitized });
    }
    return await invoke<CommandOutput>("upgrade_brew_package", { name: null });
  },

  async getSystemMetrics(): Promise<SystemMetrics> {
    const raw = await invoke<{
      cpu_usage_percent: number;
      memory_used_mb: number;
      memory_total_mb: number;
    }>("get_system_metrics");

    return {
      cpuUsagePercent: Math.round(raw.cpu_usage_percent * 10) / 10,
      memoryUsedMb: raw.memory_used_mb,
      memoryTotalMb: raw.memory_total_mb,
      activeServicesCount: 0,
    };
  },

  async notify(title: string, body: string): Promise<void> {
    await invoke("trigger_notification", { title, body });
  },

  async notifyTest(title: string, body: string): Promise<void> {
    await invoke("trigger_test_notification", { title, body });
  },

  async getBrewInfo(): Promise<BrewSystemInfo> {
    return await invoke<BrewSystemInfo>("get_brew_info");
  },

  async closeSplashScreen(): Promise<void> {
    try {
      await invoke("close_splashscreen");
    } catch (_e) {
      // Ignore if outside Tauri environment
    }
  },
};
