import React from "react";
import { BrewService, isServiceRunning } from "../../core/types/brew";
import { Play, Square, RotateCw, BarChart2 } from "lucide-react";
import { Button } from "../../core/components/Button";

interface ServiceListProps {
  services: BrewService[];
  runningActions: Record<string, boolean>;
  onStart: (name: string) => void;
  onStop: (name: string) => void;
  onRestart: (name: string) => void;
  onInspect: (service: BrewService) => void;
}

export const ServiceList: React.FC<ServiceListProps> = ({
  services,
  runningActions,
  onStart,
  onStop,
  onRestart,
  onInspect,
}) => {
  if (services.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
        No services found. Use Search to discover and install Homebrew packages.
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="services-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Status</th>
            <th>PID / User</th>
            <th>CPU</th>
            <th>RAM</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => {
            const isRunning = isServiceRunning(service.status);
            const isLoading = !!runningActions[service.name];
            const statusClass = isRunning ? "running" : service.status === "error" ? "error" : "stopped";

            return (
              <tr key={service.name}>
                <td>
                  <strong style={{ fontSize: "0.92rem", color: "var(--text-primary)" }}>
                    {service.name}
                  </strong>
                </td>

                <td>
                  <span className={`status-pill ${statusClass}`}>
                    <span className={`status-dot ${isRunning ? "pulse" : ""}`} />
                    {service.status}
                  </span>
                </td>

                <td>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {service.pid ? `PID ${service.pid}` : "None"}
                    {service.user ? ` (${service.user})` : ""}
                  </span>
                </td>

                <td>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: isRunning ? "var(--accent-primary)" : "var(--text-muted)" }}>
                    {typeof service.cpu === "number" ? `${service.cpu.toFixed(1)}%` : "-"}
                  </span>
                </td>

                <td>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: isRunning ? "var(--accent-secondary)" : "var(--text-muted)" }}>
                    {typeof service.memory === "number" ? `${service.memory} MB` : "-"}
                  </span>
                </td>

                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: "6px" }}>
                    {isRunning ? (
                      <>
                        <Button
                          className="btn btn-danger btn-icon"
                          disabled={isLoading}
                          onClick={() => onStop(service.name)}
                          title="Stop Service"
                          icon={<Square size={14} />}
                        />
                        <Button
                          className="btn btn-secondary btn-icon"
                          disabled={isLoading}
                          onClick={() => onRestart(service.name)}
                          title="Restart Service"
                          icon={<RotateCw size={14} />}
                        />
                      </>
                    ) : (
                      <Button
                        className="btn btn-success btn-icon"
                        disabled={isLoading}
                        onClick={() => onStart(service.name)}
                        title="Start Service"
                        icon={<Play size={14} />}
                      />
                    )}

                    <Button
                      className="btn btn-secondary btn-icon"
                      onClick={() => onInspect(service)}
                      title="Inspect Metrics"
                      icon={<BarChart2 size={14} />}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
