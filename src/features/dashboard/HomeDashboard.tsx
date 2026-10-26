import React, { useRef, useCallback } from "react";
import {
	BrewService,
	isServiceRunning,
	SystemMetrics,
	BrewSystemInfo,
} from "../../core/types/brew";
import { OutdatedItem } from "../../core/api/brewApi";
import { PersistedStats } from "../../core/hooks/useBrew";
import { useVirtualizer } from "../../core/hooks/useVirtualList";
import {
	Package,
	ArrowUp,
	Download,
	HardDrive,
	ArrowRight,
	RotateCw,
	MoreHorizontal,
	Box,
	Terminal,
	CheckCircle2,
	AlertCircle,
	Cpu,
} from "lucide-react";
import { Button } from "../../core/components/Button";

interface HomeDashboardProps {
	services: BrewService[];
	outdated: OutdatedItem[];
	runningActions: Record<string, any>;
	memoryUsedMb: number;
	metrics?: SystemMetrics;
	brewInfo?: BrewSystemInfo;
	stats?: PersistedStats;
	onNavigateTab: (
		tab: "installed" | "outdated" | "search" | "active" | "logs",
	) => void;
	onInspectService: (service: BrewService) => void;
	onUpgradePackage: (name?: string) => void;
	onRefreshOutdated?: () => void;
}

const ESTIMATED_DASHBOARD_ROW_HEIGHT = 58;
const ROW_GAP = 0;
const OVERSCAN_COUNT = 5;
const DASHBOARD_SNAPSHOT_KEY = "homebrew_dashboard_recent_virtual_list";

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
	services,
	outdated,
	runningActions,
	memoryUsedMb,
	metrics,
	brewInfo,
	stats,
	onNavigateTab,
	onInspectService,
	onUpgradePackage,
}) => {
	// Active operations count: running services count with fallback to persisted stats
	const activeOperationsCount =
		services.length > 0
			? services.filter((s) => isServiceRunning(s.status)).length
			: (stats?.activeOperations ?? 0);

	const installedPackagesCount =
		stats?.installedPackages && stats.installedPackages > 0
			? stats.installedPackages
			: services.length;

	const availableUpdatesCount =
		outdated.length > 0 ? outdated.length : (stats?.availableUpdates ?? 0);

	const memoryInGb = (memoryUsedMb / 1024).toFixed(1);
	const cpuPercent = metrics?.cpuUsagePercent ?? 0;
	const totalMemMb = metrics?.memoryTotalMb ?? 0;
	const ramPercent =
		totalMemMb > 0 ? Math.round((memoryUsedMb / totalMemMb) * 100) : 0;

	// Identify which packages are outdated
	const outdatedSet = new Set(outdated.map((o) => o.name.toLowerCase()));

	// Display only active packages whose status is started
	const displayPackages = services.filter(
		(s) => s.status?.toLowerCase() === "started" || isServiceRunning(s.status),
	);

	const scrollParentRef = useRef<HTMLDivElement | null>(null);

	const getScrollElement = useCallback(() => scrollParentRef.current, []);
	const estimateSize = useCallback(() => ESTIMATED_DASHBOARD_ROW_HEIGHT, []);
	const getItemKey = useCallback(
		(index: number) => displayPackages[index]?.name ?? index,
		[displayPackages],
	);

	const rowVirtualizer = useVirtualizer({
		count: displayPackages.length,
		getScrollElement,
		estimateSize,
		overscan: OVERSCAN_COUNT,
		gap: ROW_GAP,
		getItemKey,
		snapshotKey: DASHBOARD_SNAPSHOT_KEY,
	});

	const virtualItems = rowVirtualizer.getVirtualItems();
	const totalSize = rowVirtualizer.getTotalSize();

	const getPackageIcon = (name: string) => {
		const n = name.toLowerCase();
		if (n.includes("git")) {
			return (
				<div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
					<Terminal size={16} strokeWidth={2.2} />
				</div>
			);
		}
		if (n.includes("node") || n.includes("mongo")) {
			return (
				<div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
					<Box size={16} strokeWidth={2.2} />
				</div>
			);
		}
		if (n.includes("python") || n.includes("redis")) {
			return (
				<div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
					<Package size={16} strokeWidth={2.2} />
				</div>
			);
		}
		if (n.includes("docker") || n.includes("nginx")) {
			return (
				<div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
					<Box size={16} strokeWidth={2.2} />
				</div>
			);
		}
		return (
			<div className="w-8 h-8 rounded-lg bg-indigo-50 text-brand-primary flex items-center justify-center shrink-0">
				<Package size={16} strokeWidth={2} />
			</div>
		);
	};

	return (
		<div className="flex flex-col gap-6 w-full">
			{/* 1. System Metrics Bar */}
			<div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-5 shadow-xs flex flex-col min-[1060px]:flex-row min-[1060px]:items-center justify-between gap-4 min-[1060px]:gap-6">
				{/* Left: Homebrew Status */}
				<div className="flex items-center gap-3 min-w-0">
					<div className="w-10 h-10 rounded-xl bg-[#E8F8F0] text-brand-success flex items-center justify-center shrink-0">
						<CheckCircle2 size={18} strokeWidth={2.2} />
					</div>
					<div className="flex flex-col min-w-0">
						<div className="flex items-center gap-2">
							<h3 className="font-bold text-sm text-brand-text truncate">
								Homebrew Status
							</h3>
							<span
								className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
									brewInfo?.isActive !== false
										? "bg-[#E8F8F0] text-brand-success"
										: "bg-rose-50 text-rose-600"
								}`}
							>
								{brewInfo?.isActive !== false ? "Active" : "Inactive"}
							</span>
						</div>
						<span className="text-xs text-brand-muted font-mono truncate mt-0.5">
							{`Version: ${brewInfo?.version.split("Homebrew")[1]}` ||
								"Homebrew"}
							{/* {brewInfo?.prefix || "/opt/homebrew"} */}
						</span>
					</div>
				</div>

				{/* Right: CPU and RAM Gauges */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full min-[1060px]:w-96 min-[1060px]:shrink-0 pt-3 min-[1060px]:pt-0 border-t border-brand-border min-[1060px]:border-t-0">
					{/* CPU Gauge */}
					<div className="flex flex-col gap-1.5 min-w-0">
						<div className="flex items-center justify-between text-xs">
							<div className="flex items-center gap-1.5 min-w-0">
								<Cpu size={13} className="text-brand-primary shrink-0" />
								<span className="text-brand-muted font-medium text-xs truncate">
									CPU Usage
								</span>
							</div>
							<span className="text-brand-text font-bold text-xs shrink-0 pl-1">
								{cpuPercent}%
							</span>
						</div>
						<div className="w-full h-2 bg-brand-primary-light rounded-full overflow-hidden">
							<div
								className="bg-brand-primary h-full rounded-full transition-all duration-500"
								style={{ width: `${Math.min(100, Math.max(0, cpuPercent))}%` }}
							/>
						</div>
					</div>

					{/* RAM Gauge */}
					<div className="flex flex-col gap-1.5 min-w-0">
						<div className="flex items-center justify-between text-xs">
							<div className="flex items-center gap-1.5 min-w-0">
								<HardDrive
									size={13}
									className="text-brand-secondary shrink-0"
								/>
								<span className="text-brand-muted font-medium text-xs truncate">
									RAM Usage
								</span>
							</div>
							<span className="text-brand-text font-bold text-xs shrink-0 pl-1">
								{ramPercent}%
							</span>
						</div>
						<div className="w-full h-2 bg-brand-primary-light rounded-full overflow-hidden">
							<div
								className="bg-brand-secondary h-full rounded-full transition-all duration-500"
								style={{ width: `${Math.min(100, Math.max(0, ramPercent))}%` }}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* 2. Four Stats Cards */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Card 1: Installed */}
				<div className="bg-white rounded-2xl border border-brand-border p-4 shadow-xs flex items-center gap-3.5">
					<div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
						<Package size={20} strokeWidth={2.2} />
					</div>
					<div className="flex flex-col min-w-0">
						<span className="text-xl font-bold text-brand-text leading-tight">
							{installedPackagesCount}
						</span>
						<span className="text-xs text-brand-muted truncate mt-0.5">
							Installed Packages
						</span>
					</div>
				</div>

				{/* Card 2: Updates */}
				<div className="bg-white rounded-2xl border border-brand-border p-4 shadow-xs flex items-center gap-3.5">
					<div className="w-11 h-11 rounded-xl bg-emerald-50 text-brand-success flex items-center justify-center shrink-0">
						<ArrowUp size={20} strokeWidth={2.2} />
					</div>
					<div className="flex flex-col min-w-0">
						<span className="text-xl font-bold text-brand-text leading-tight">
							{availableUpdatesCount}
						</span>
						<span className="text-xs text-brand-muted truncate mt-0.5">
							Available Updates
						</span>
					</div>
				</div>

				{/* Card 3: Active Operations */}
				<div className="bg-white rounded-2xl border border-brand-border p-4 shadow-xs flex items-center gap-3.5">
					<div className="w-11 h-11 rounded-xl bg-purple-50 text-brand-primary flex items-center justify-center shrink-0">
						<Download size={20} strokeWidth={2.2} />
					</div>
					<div className="flex flex-col min-w-0">
						<span className="text-xl font-bold text-brand-text leading-tight">
							{activeOperationsCount}
						</span>
						<span className="text-xs text-brand-muted truncate mt-0.5">
							Active Operations
						</span>
					</div>
				</div>

				{/* Card 4: Memory In Use */}
				<div className="bg-white rounded-2xl border border-brand-border p-4 shadow-xs flex items-center gap-3.5">
					<div className="w-11 h-11 rounded-xl bg-amber-50 text-brand-warning flex items-center justify-center shrink-0">
						<HardDrive size={20} strokeWidth={2.2} />
					</div>
					<div className="flex flex-col min-w-0">
						<span className="text-xl font-bold text-brand-text leading-tight">
							{memoryInGb} GB
						</span>
						<span className="text-xs text-brand-muted truncate mt-0.5">
							Memory In Use
						</span>
					</div>
				</div>
			</div>

			{/* 3. Recent Packages Card Table */}
			<div className="bg-white rounded-2xl border border-brand-border p-6 shadow-xs flex flex-col">
				<div className="flex items-center justify-between mb-5">
					<div className="flex items-center gap-2.5">
						<h3 className="text-base font-bold text-brand-text">
							Recent Packages
						</h3>
						<span className="text-[11px] font-semibold bg-[#E8F8F0] text-brand-success px-2.5 py-0.5 rounded-full">
							Started Only
						</span>
					</div>
					<Button
						onClick={() => onNavigateTab("installed")}
						className="text-xs font-semibold text-brand-primary hover:text-brand-primary-hover flex items-center gap-1 cursor-pointer transition-colors bg-transparent"
					>
						<span>View All</span>
						<ArrowRight size={13} />
					</Button>
				</div>

				{displayPackages.length === 0 ? (
					<div className="text-center py-12 text-sm text-brand-muted">
						No active packages with started status found running on macOS.
					</div>
				) : (
					<div className="overflow-x-auto">
						<div className="min-w-160">
							{/* Table Header */}
							<div className="grid grid-cols-12 gap-4 pb-3 border-b border-brand-border text-xs font-semibold text-brand-muted select-none">
								<div className="col-span-4">Name</div>
								<div className="col-span-2">Version / PID</div>
								<div className="col-span-2">Status</div>
								<div className="col-span-3">Installed On</div>
								<div className="col-span-1 text-right">Actions</div>
							</div>

							{/* Virtualized Runway */}
							<div
								ref={scrollParentRef}
								role="region"
								aria-label="Recent started packages list"
								className="max-h-96 overflow-y-auto select-none"
							>
								<div className="relative w-full" style={{ height: `${totalSize}px` }}>
									{virtualItems.map((virtualRow) => {
										const service = displayPackages[virtualRow.index];
										if (!service) return null;

										const isOutdated = outdatedSet.has(
											service.name.toLowerCase(),
										);
										const isRunning =
											service.status === "started" ||
											service.status === "running";

										return (
											<div
												key={virtualRow.key}
												data-index={virtualRow.index}
												ref={rowVirtualizer.measureElement}
												className="absolute top-0 left-0 w-full"
												style={{
													transform: `translateY(${virtualRow.start}px)`,
												}}
											>
												<div className="grid grid-cols-12 gap-4 items-center py-3 border-b border-brand-border/60 hover:bg-slate-50/50 transition-colors">
													{/* Name */}
													<div className="col-span-4 flex items-center gap-3 min-w-0 pr-2">
														{getPackageIcon(service.name)}
														<div className="flex flex-col min-w-0">
															<span className="font-semibold text-sm text-brand-text truncate">
																{service.name}
															</span>
															<span className="text-[11px] text-brand-muted truncate">
																{service.file
																	? service.file.split("/").pop()
																	: "formula"}
															</span>
														</div>
													</div>

													{/* Version / PID */}
													<div className="col-span-2 font-mono text-xs text-brand-muted truncate">
														{service.pid ? `PID: ${service.pid}` : "stable"}
													</div>

													{/* Status */}
													<div className="col-span-2">
														{isOutdated ? (
															<span className="inline-flex items-center gap-1 bg-[#FEF6E8] text-brand-warning text-xs font-semibold px-2.5 py-0.5 rounded-full">
																<AlertCircle size={12} />
																<span>Update Available</span>
															</span>
														) : isRunning ? (
															<span className="inline-flex items-center gap-1 bg-[#E8F8F0] text-brand-success text-xs font-semibold px-2.5 py-0.5 rounded-full">
																<CheckCircle2 size={12} />
																<span>Active</span>
															</span>
														) : (
															<span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
																<span>Installed</span>
															</span>
														)}
													</div>

													{/* Installed On / Details */}
													<div className="col-span-3 text-xs text-brand-muted truncate pr-2">
														{service.user
															? `User: ${service.user}`
															: "Homebrew managed"}
													</div>

													{/* Actions */}
													<div className="col-span-1 text-right flex justify-end">
														{isOutdated ? (
															(() => {
																const isUpgrading =
																	runningActions[service.name] === "upgrade" ||
																	!!runningActions[service.name] ||
																	!!runningActions["all"];
																return (
																	<Button
																		onClick={() => onUpgradePackage(service.name)}
																		disabled={isUpgrading}
																		isLoading={isUpgrading}
																		loadingText="Updating..."
																		spinner={
																			<RotateCw size={11} className="animate-spin text-current" />
																		}
																		className="bg-brand-primary-light hover:bg-brand-primary text-brand-primary hover:text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 shrink-0"
																	>
																		Update
																	</Button>
																);
															})()
														) : (
															<Button
																onClick={() => isRunning && onInspectService(service)}
																disabled={!isRunning}
																className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors shrink-0 ${
																	isRunning
																		? "hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
																		: "opacity-40 text-slate-300 cursor-not-allowed"
																}`}
																title={
																	isRunning
																		? "Inspect Service"
																		: "Service must be running to view stats"
																}
																icon={<MoreHorizontal size={16} />}
															/>
														)}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
