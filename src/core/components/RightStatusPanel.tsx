import React from "react";
import { SystemMetrics, CommandLogEntry, BrewSystemInfo } from "../types/brew";
import {
	ArrowUp,
	Download,
	RotateCw,
	Package,
	Settings,
	ArrowRight,
} from "lucide-react";
import { Button } from "./Button";

interface RightStatusPanelProps {
	metrics: SystemMetrics;
	logs: CommandLogEntry[];
	brewInfo?: BrewSystemInfo;
	onViewAllLogs: () => void;
}

export const RightStatusPanel: React.FC<RightStatusPanelProps> = ({
	metrics,
	logs,
	brewInfo,
	onViewAllLogs,
}) => {
	const ramPercent =
		metrics.memoryTotalMb > 0
			? Math.round((metrics.memoryUsedMb / metrics.memoryTotalMb) * 100)
			: 0;

	// Fallback default activities if no logs executed yet
	const displayActivities =
		logs.length > 0
			? logs.slice(-5).reverse()
			: [
					{
						id: "1",
						text: "Started HomeBrew Manager",
						timestamp: "Just now",
						type: "success",
					},
					{
						id: "2",
						text: "Verified Homebrew core environment",
						timestamp: "1m ago",
						type: "info",
					},
					{
						id: "3",
						text: "Loaded installed services & packages",
						timestamp: "2m ago",
						type: "stdout",
					},
				];

	const getActivityIcon = (_type: string, text: string) => {
		const lower = text.toLowerCase();
		if (lower.includes("upgrade") || lower.includes("update")) {
			return (
				<div className="w-8 h-8 rounded-full bg-emerald-50 text-brand-success flex items-center justify-center shrink-0">
					<ArrowUp size={14} strokeWidth={2.5} />
				</div>
			);
		}
		if (lower.includes("install")) {
			return (
				<div className="w-8 h-8 rounded-full bg-purple-50 text-brand-primary flex items-center justify-center shrink-0">
					<Download size={14} strokeWidth={2.5} />
				</div>
			);
		}
		if (lower.includes("check") || lower.includes("refresh")) {
			return (
				<div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
					<RotateCw size={14} strokeWidth={2.5} />
				</div>
			);
		}
		if (lower.includes("service") || lower.includes("daemon")) {
			return (
				<div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
					<Settings size={14} strokeWidth={2.5} />
				</div>
			);
		}
		return (
			<div className="w-8 h-8 rounded-full bg-indigo-50 text-brand-primary flex items-center justify-center shrink-0">
				<Package size={14} strokeWidth={2.5} />
			</div>
		);
	};

	return (
		<aside className="hidden xl:flex w-80 shrink-0 bg-brand-sidebar border-l border-brand-border p-5 flex-col gap-5 overflow-y-auto select-none h-full">
			{/* Top Card: Homebrew Status */}
			<div className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs flex flex-col gap-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="w-2.5 h-2.5 rounded-full bg-brand-success animate-pulse" />
						<h3 className="font-bold text-sm text-brand-text">
							Homebrew Status
						</h3>
					</div>
					<div className="flex items-center gap-1.5">
						<span
							className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
								brewInfo?.isActive !== false
									? "bg-[#E8F8F0] text-brand-success"
									: "bg-rose-50 text-rose-600"
							}`}
						>
							{brewInfo?.isActive !== false ? "Active" : "Inactive"}
						</span>
						<span className="text-xs text-brand-muted font-mono">
							{brewInfo?.version || "Homebrew"}
						</span>
					</div>
				</div>

				{/* CPU Usage Bar */}
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between text-xs">
						<span className="text-brand-muted font-medium">CPU Usage</span>
						<span className="text-brand-text font-semibold">
							{metrics.cpuUsagePercent}%
						</span>
					</div>
					<div className="w-full h-2 bg-brand-primary-light rounded-full overflow-hidden">
						<div
							className="bg-brand-primary h-full rounded-full transition-all duration-500"
							style={{
								width: `${Math.min(100, Math.max(0, metrics.cpuUsagePercent))}%`,
							}}
						/>
					</div>
				</div>

				{/* Memory Usage Bar */}
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between text-xs">
						<span className="text-brand-muted font-medium">Memory Usage</span>
						<span className="text-brand-text font-semibold">{ramPercent}%</span>
					</div>
					<div className="w-full h-2 bg-brand-primary-light rounded-full overflow-hidden">
						<div
							className="bg-brand-secondary h-full rounded-full transition-all duration-500"
							style={{ width: `${Math.min(100, Math.max(0, ramPercent))}%` }}
						/>
					</div>
				</div>
			</div>

			{/* Bottom Card: Recent Activity */}
			<div className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs flex-1 flex flex-col">
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-bold text-sm text-brand-text">Recent Activity</h3>
					<Button
						onClick={onViewAllLogs}
						className="text-xs font-semibold text-brand-primary hover:text-brand-primary-hover flex items-center gap-1 cursor-pointer transition-colors bg-transparent"
					>
						<span>View All</span>
						<ArrowRight size={12} />
					</Button>
				</div>

				{/* Activity Items */}
				<div className="flex flex-col gap-3.5 flex-1">
					{displayActivities.map((entry) => (
						<div key={entry.id} className="flex items-start gap-3">
							{getActivityIcon(entry.type, entry.text)}
							<div className="flex flex-col min-w-0 flex-1">
								<span className="text-xs font-semibold text-brand-text leading-tight truncate">
									{entry.text}
								</span>
								<span className="text-[11px] text-brand-muted mt-0.5">
									{entry.timestamp}
								</span>
							</div>
						</div>
					))}
				</div>
			</div>
		</aside>
	);
};
