export type ServiceStatus = "started" | "running" | "stopped" | "error" | "none";

export function isServiceRunning(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "started" || s === "running";
}

export interface BrewService {
  name: string;
  status: string;
  user?: string;
  file?: string;
  pid?: number;
  cpu?: number | null;        // CPU percentage
  memory?: number | null;     // Memory in MB
}

export interface BrewPackage {
  name: string;
  fullName: string;
  version: string;
  description: string;
  homepage?: string;
  isInstalled: boolean;
  isOutdated: boolean;
  installedVersion?: string;
}

export interface SystemMetrics {
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  activeServicesCount: number;
}

export interface MetricThresholdConfig {
  cpuThresholdPercent: number;
  ramThresholdMb: number;
  notificationsEnabled: boolean;
  cooldownSeconds: number;
}

export interface CommandLogEntry {
  id: string;
  timestamp: string;
  type: "stdout" | "stderr" | "info" | "success" | "error";
  text: string;
}

export interface BrewSystemInfo {
  version: string;
  prefix: string;
  isActive: boolean;
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt?: string | null;
  htmlUrl: string;
}
