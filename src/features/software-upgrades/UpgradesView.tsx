import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { InstalledPackageItem, OutdatedItem } from "../../core/api/brewApi";
import { BrewService } from "../../core/types/brew";
import { useVirtualizer } from "../../core/hooks/useVirtualList";
import {
	ArrowUpCircle,
	RefreshCw,
	CheckCircle2,
	ArrowRight,
	RotateCw,
	Package,
	AppWindow,
	Terminal,
	Layers,
	Flame,
} from "lucide-react";
import { Button } from "../../core/components/Button";

interface UpgradesViewProps {
	outdated: OutdatedItem[];
	installedPackages?: InstalledPackageItem[];
	services?: BrewService[];
	isLoading: boolean;
	runningActions?: Record<string, any>;
	onRefresh: () => void;
	onUpgrade: (name?: string, isCask?: boolean) => void;
}

interface MergedPackageItem {
	name: string;
	installedVersions: string[];
	currentVersion?: string;
	isOutdated: boolean;
	packageType: "cask" | "formula";
}

type UpgradeTab = "all" | "outdated" | "casks" | "formulae";

const ESTIMATED_ROW_HEIGHT = 86;
const ROW_GAP = 12;
const OVERSCAN_COUNT = 5;
const UPGRADES_SNAPSHOT_KEY = "homebrew_upgrades_virtual_list";

export const UpgradesView: React.FC<UpgradesViewProps> = ({
	outdated = [],
	installedPackages = [],
	services = [],
	isLoading,
	runningActions = {},
	onRefresh,
	onUpgrade,
}) => {
	const scrollParentRef = useRef<HTMLDivElement | null>(null);
	const [activeTab, setActiveTab] = useState<UpgradeTab>("outdated");

	useEffect(() => {
		// Only check if bootstrap data is not already loaded
		if (outdated.length === 0 && !isLoading) {
			onRefresh();
		}
	}, []);

	const isUpgradingAll = !!runningActions["all"];

	const allPackagesList = useMemo<MergedPackageItem[]>(() => {
		const map = new Map<string, MergedPackageItem>();

		// 1. Add all installed Homebrew packages (formulae & casks)
		for (const pkg of installedPackages) {
			if (!pkg?.name) continue;
			const versions = Array.isArray(pkg.installed_versions)
				? pkg.installed_versions
				: Array.isArray(pkg.installedVersions)
					? pkg.installedVersions
					: [];
			map.set(pkg.name, {
				name: pkg.name,
				installedVersions: versions,
				isOutdated: false,
				packageType: pkg.packageType === "cask" ? "cask" : "formula",
			});
		}

		// 2. Ensure all services from brew services list are also represented
		for (const svc of services) {
			if (!svc?.name) continue;
			if (!map.has(svc.name)) {
				map.set(svc.name, {
					name: svc.name,
					installedVersions: [],
					isOutdated: false,
					packageType: "formula",
				});
			}
		}

		// 3. Overlay outdated package versions and mark as having updates available
		for (const item of outdated) {
			if (!item?.name) continue;
			const installed = Array.isArray(item.installed_versions)
				? item.installed_versions
				: Array.isArray((item as any).installedVersions)
					? (item as any).installedVersions
					: [];
			const current =
				item.current_version || (item as any).currentVersion || "latest";

			const existing = map.get(item.name);
			map.set(item.name, {
				name: item.name,
				installedVersions:
					installed.length > 0 ? installed : existing?.installedVersions || [],
				currentVersion: current,
				isOutdated: true,
				packageType: item.packageType === "cask" ? "cask" : existing?.packageType || "formula",
			});
		}

		// Sort so outdated packages appear at the top, followed by up-to-date packages alphabetically
		return Array.from(map.values()).sort((a, b) => {
			if (a.isOutdated !== b.isOutdated) {
				return a.isOutdated ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});
	}, [installedPackages, services, outdated]);

	// Filter based on selected tab
	const displayedList = useMemo(() => {
		if (activeTab === "outdated") return allPackagesList.filter((p) => p.isOutdated);
		if (activeTab === "casks") return allPackagesList.filter((p) => p.packageType === "cask");
		if (activeTab === "formulae") return allPackagesList.filter((p) => p.packageType === "formula");
		return allPackagesList;
	}, [allPackagesList, activeTab]);

	const getScrollElement = useCallback(() => scrollParentRef.current, []);
	const estimateSize = useCallback(() => ESTIMATED_ROW_HEIGHT, []);
	const getItemKey = useCallback(
		(index: number) => displayedList[index]?.name ?? index,
		[displayedList],
	);

	const rowVirtualizer = useVirtualizer({
		count: displayedList.length,
		getScrollElement,
		estimateSize,
		overscan: OVERSCAN_COUNT,
		gap: ROW_GAP,
		getItemKey,
		snapshotKey: UPGRADES_SNAPSHOT_KEY,
	});

	const virtualItems = rowVirtualizer.getVirtualItems();
	const totalSize = rowVirtualizer.getTotalSize();

	const casksCount = allPackagesList.filter((p) => p.packageType === "cask").length;
	const formulaeCount = allPackagesList.filter((p) => p.packageType === "formula").length;

	return (
		<div className="flex flex-col gap-6">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-bold text-brand-text tracking-tight">
						Software Upgrades
					</h2>
					<p className="text-sm text-brand-muted mt-1">
						Showing <strong>{allPackagesList.length}</strong> installed
						packages ({outdated.length} update
						{outdated.length === 1 ? "" : "s"} available).
					</p>
				</div>

				<div className="flex items-center gap-3">
					<Button
						className="bg-white hover:bg-slate-50 text-brand-text border border-brand-border font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-xs gap-2"
						disabled={isLoading}
						isLoading={isLoading}
						loadingText="Checking..."
						onClick={onRefresh}
						icon={<RefreshCw size={13} />}
						spinner={<RotateCw size={13} className="animate-spin text-brand-muted" />}
					>
						Check Updates
					</Button>

					{outdated.length > 0 && (
						<Button
							className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-xs gap-2"
							disabled={isLoading || isUpgradingAll}
							isLoading={isUpgradingAll}
							loadingText="Upgrading all..."
							onClick={() => onUpgrade(undefined, false)}
							icon={<ArrowUpCircle size={14} />}
							spinner={<RotateCw size={14} className="animate-spin text-white" />}
						>
							Upgrade All ({outdated.length})
						</Button>
					)}
				</div>
			</div>

			{/* Filter Tabs */}
			<div className="flex items-center gap-2 flex-wrap">
				<button
					type="button"
					onClick={() => setActiveTab("all")}
					className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
						activeTab === "all"
							? "bg-brand-primary text-white shadow-xs"
							: "bg-white text-brand-muted hover:text-brand-text border border-brand-border"
					}`}
				>
					<Layers size={13} />
					<span>All Packages</span>
					<span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
						activeTab === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-brand-muted"
					}`}>
						{allPackagesList.length}
					</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveTab("outdated")}
					className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
						activeTab === "outdated"
							? "bg-amber-500 text-white shadow-xs"
							: "bg-white text-brand-muted hover:text-amber-600 border border-brand-border"
					}`}
				>
					<Flame size={13} />
					<span>Updates Available</span>
					<span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
						activeTab === "outdated" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
					}`}>
						{outdated.length}
					</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveTab("casks")}
					className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
						activeTab === "casks"
							? "bg-purple-600 text-white shadow-xs"
							: "bg-white text-brand-muted hover:text-purple-600 border border-brand-border"
					}`}
				>
					<AppWindow size={13} />
					<span>Casks</span>
					<span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
						activeTab === "casks" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"
					}`}>
						{casksCount}
					</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveTab("formulae")}
					className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
						activeTab === "formulae"
							? "bg-blue-600 text-white shadow-xs"
							: "bg-white text-brand-muted hover:text-blue-600 border border-brand-border"
					}`}
				>
					<Terminal size={13} />
					<span>Formulae</span>
					<span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
						activeTab === "formulae" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
					}`}>
						{formulaeCount}
					</span>
				</button>
			</div>

			{/* Main Content Area */}
			{isLoading && allPackagesList.length === 0 ? (
				<div className="bg-white rounded-3xl border border-brand-border p-16 text-center shadow-xs flex flex-col items-center justify-center">
					<RotateCw
						size={28}
						className="animate-spin text-brand-primary mb-3"
					/>
					<h3 className="text-base font-bold text-brand-text">
						Checking for Package Upgrades...
					</h3>
					<p className="text-xs text-brand-muted mt-1 max-w-sm">
						Running safe inspect queries against Homebrew formulae and casks.
					</p>
				</div>
			) : displayedList.length === 0 ? (
				<div className="bg-white rounded-3xl border border-brand-border p-16 text-center shadow-xs flex flex-col items-center justify-center">
					<div className="w-14 h-14 rounded-2xl bg-[#E8F8F0] text-brand-success flex items-center justify-center mb-3.5">
						<CheckCircle2 size={32} />
					</div>
					<h3 className="text-base font-bold text-brand-text">
						{activeTab === "outdated" ? "All Packages Up to Date!" : "No Packages Found"}
					</h3>
					<p className="text-xs text-brand-muted mt-1 max-w-sm">
						{activeTab === "outdated"
							? "Every installed Homebrew formula and cask is at its latest version."
							: "No packages matching the selected filter."}
					</p>
				</div>
			) : (
				/* Product-owned Scroll Surface & Virtualized Runway */
				<div
					ref={scrollParentRef}
					role="region"
					aria-label="Installed packages list"
					className="h-[calc(100vh-270px)] min-h-96 overflow-y-auto pr-1 select-none"
				>
					<div className="relative w-full" style={{ height: `${totalSize}px` }}>
						{virtualItems.map((virtualRow) => {
							const item = displayedList[virtualRow.index];
							if (!item) return null;

							const installed = item.installedVersions;
							const current = item.currentVersion || "latest";
							const isItemUpgrading =
								!!runningActions[item.name] ||
								(item.isOutdated && isUpgradingAll);
							const isCask = item.packageType === "cask";

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
									<div className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between gap-4">
										<div className="flex flex-col min-w-0">
											<div className="flex items-center gap-2.5 flex-wrap">
												<span className="font-bold text-base text-brand-text flex items-center gap-2">
													{isCask ? (
														<AppWindow
															size={16}
															className={
																item.isOutdated
																	? "text-purple-600 shrink-0"
																	: "text-brand-muted shrink-0"
															}
														/>
													) : (
														<Package
															size={16}
															className={
																item.isOutdated
																	? "text-brand-primary shrink-0"
																	: "text-brand-muted shrink-0"
															}
														/>
													)}
													<span>{item.name}</span>
												</span>

												<span
													className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
														isCask
															? "bg-purple-100 text-purple-700 border border-purple-200"
															: "bg-blue-100 text-blue-700 border border-blue-200"
													}`}
												>
													{isCask ? "Cask" : "Formula"}
												</span>

												{item.isOutdated ? (
													<span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#FEF6E8] text-brand-warning px-2.5 py-0.5 rounded-full">
														Update Available
													</span>
												) : (
													<span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#E8F8F0] text-brand-success px-2.5 py-0.5 rounded-full">
														<CheckCircle2 size={11} />
														<span>Up to Date</span>
													</span>
												)}
											</div>

											<div className="flex items-center gap-2 font-mono text-xs text-brand-muted mt-1.5 flex-wrap">
												{item.isOutdated ? (
													<>
														<span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md font-medium">
															{installed.join(", ") || "installed"}
														</span>
														<ArrowRight
															size={12}
															className="text-brand-muted"
														/>
														<span className="bg-[#E8F8F0] text-brand-success px-2 py-0.5 rounded-md font-medium">
															{current}
														</span>
													</>
												) : (
													<span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
														{installed.length > 0
															? `v${installed[installed.length - 1]}`
															: "Installed"}
													</span>
												)}
											</div>
										</div>

										{/* Conditionally show Upgrade button only if package has an available update */}
										{item.isOutdated && (
											<Button
												className="bg-brand-primary-light hover:bg-brand-primary text-brand-primary hover:text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs gap-2 shrink-0 cursor-pointer"
												disabled={isLoading}
												isLoading={isItemUpgrading}
												loadingText="Upgrading..."
												onClick={() => onUpgrade(item.name, isCask)}
												icon={<ArrowUpCircle size={13} />}
												spinner={
													<RotateCw size={13} className="animate-spin" />
												}
											>
												Upgrade
											</Button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};
