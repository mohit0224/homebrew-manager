import React from "react";
import { Server, Activity, Search, ArrowUpCircle, Terminal } from "lucide-react";
import { Button } from "./Button";

interface TabNavigationProps {
  activeTab: "installed" | "active" | "search" | "outdated" | "logs";
  onTabChange: (tab: "installed" | "active" | "search" | "outdated" | "logs") => void;
  installedCount: number;
  activeCount: number;
  outdatedCount: number;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  installedCount,
  activeCount,
  outdatedCount,
}) => {
  return (
    <nav className="nav-tabs">
      <Button
        className={`nav-tab ${activeTab === "installed" ? "active" : ""}`}
        onClick={() => onTabChange("installed")}
      >
        <Server size={16} />
        <span>Installed Services</span>
        <span className="tab-badge">{installedCount}</span>
      </Button>

      <Button
        className={`nav-tab ${activeTab === "active" ? "active" : ""}`}
        onClick={() => onTabChange("active")}
      >
        <Activity size={16} color={activeCount > 0 ? "#10b981" : undefined} />
        <span>Active Services</span>
        <span className={`tab-badge ${activeCount > 0 ? "active-pulse" : ""}`}>
          {activeCount}
        </span>
      </Button>

      <Button
        className={`nav-tab ${activeTab === "search" ? "active" : ""}`}
        onClick={() => onTabChange("search")}
      >
        <Search size={16} />
        <span>Search & Install</span>
      </Button>

      <Button
        className={`nav-tab ${activeTab === "outdated" ? "active" : ""}`}
        onClick={() => onTabChange("outdated")}
      >
        <ArrowUpCircle size={16} />
        <span>Upgrades</span>
        {outdatedCount > 0 && (
          <span className="tab-badge" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b" }}>
            {outdatedCount}
          </span>
        )}
      </Button>

      <Button
        className={`nav-tab ${activeTab === "logs" ? "active" : ""}`}
        onClick={() => onTabChange("logs")}
      >
        <Terminal size={16} />
        <span>Terminal Logs</span>
      </Button>
    </nav>
  );
};
