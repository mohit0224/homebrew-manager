import React, { useEffect, useMemo, useRef, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "../../core/components/Button";

interface UpgradesViewProps {
	outdated: OutdatedItem[];
	installedPackages?: InstalledPackageItem[];
	services?: BrewService[];
	isLoading: boolean;
	runningActions?: Record<string, any>;
	onRefresh: () => void;
	onUpgrade: (name?: string) => void;
}

interface MergedPackageItem {
	name: string;
	installedVersions: string[];
	currentVersion?: string;
	isOutdated: boolean;
}

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

	const getScrollElement = useCallback(() => scrollParentRef.current, []);
	const estimateSize = useCallback(() => ESTIMATED_ROW_HEIGHT, []);
	const getItemKey = useCallback(
		(index: number) => allPackagesList[index]?.name ?? index,
		[allPackagesList],
	);

	const rowVirtualizer = useVirtualizer({
		count: allPackagesList.length,
		getScrollElement,
		estimateSize,
		overscan: OVERSCAN_COUNT,
		gap: ROW_GAP,
		getItemKey,
		snapshotKey: UPGRADES_SNAPSHOT_KEY,
	});

	const virtualItems = rowVirtualizer.getVirtualItems();
	const totalSize = rowVirtualizer.getTotalSize();

	return (
		<div className="flex flex-col gap-6">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-bold text-brand-text tracking-tight">
						Software Upgrades
					</h2>
					<p className="text-sm text-brand-muted mt-1">
						Showing all <strong>{allPackagesList.length}</strong> installed
						Homebrew packages ({outdated.length} update
						{outdated.length === 1 ? "" : "s"} available).
					</p>
				</div>

				<div className="flex items-center gap-2.5 shrink-0">
					<Button
						className="bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border border-brand-border font-semibold text-xs px-3.5 py-2.5 rounded-xl shadow-xs gap-2"
						onClick={() => onRefresh()}
						isLoading={isLoading}
						loadingText="Checking..."
						disabled={isUpgradingAll}
						icon={<RefreshCw size={14} />}
						spinner={
							<RefreshCw
								size={14}
								className="animate-spin text-brand-primary"
							/>
						}
					>
						Check Updates
					</Button>

					{outdated && outdated.length > 0 && (
						<Button
							className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs gap-2"
							onClick={() => onUpgrade()}
							isLoading={isUpgradingAll}
							loadingText={`Upgrading All (${outdated.length})...`}
							disabled={isLoading}
							icon={<ArrowUpCircle size={14} />}
							spinner={
								<RotateCw size={14} className="animate-spin text-white" />
							}
						>
							{`Upgrade All (${outdated.length})`}
						</Button>
					)}
				</div>
			</div>

			{/* Content */}
			{isLoading && allPackagesList.length === 0 ? (
				<div className="bg-white rounded-3xl border border-brand-border p-16 text-center shadow-xs flex flex-col items-center justify-center">
					<div className="w-14 h-14 rounded-2xl bg-indigo-50 text-brand-primary flex items-center justify-center mb-3.5">
						<RotateCw size={28} className="animate-spin" />
					</div>
					<h3 className="text-base font-bold text-brand-text">
						Checking for Updates...
					</h3>
					<p className="text-xs text-brand-muted mt-1 max-w-sm">
						Scanning Homebrew formulae and casks for available updates.
					</p>
				</div>
			) : allPackagesList.length === 0 ? (
				<div className="bg-white rounded-3xl border border-brand-border p-16 text-center shadow-xs flex flex-col items-center justify-center">
					<div className="w-14 h-14 rounded-2xl bg-[#E8F8F0] text-brand-success flex items-center justify-center mb-3.5">
						<CheckCircle2 size={32} />
					</div>
					<h3 className="text-base font-bold text-brand-text">
						No Installed Packages Found
					</h3>
					<p className="text-xs text-brand-muted mt-1 max-w-sm">
						No Homebrew formulae or casks were detected in your environment.
					</p>
				</div>
			) : (
				/* Product-owned Scroll Surface & Virtualized Runway */
				<div
					ref={scrollParentRef}
					role="region"
					aria-label="Installed packages list"
					className="h-[calc(100vh-230px)] min-h-96 overflow-y-auto pr-1 select-none"
				>
					<div className="relative w-full" style={{ height: `${totalSize}px` }}>
						{virtualItems.map((virtualRow) => {
							const item = allPackagesList[virtualRow.index];
							if (!item) return null;

							const installed = item.installedVersions;
							const current = item.currentVersion || "latest";
							const isItemUpgrading =
								!!runningActions[item.name] ||
								(item.isOutdated && isUpgradingAll);

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
													<Package
														size={15}
														className={
															item.isOutdated
																? "text-brand-primary shrink-0"
																: "text-brand-muted shrink-0"
														}
													/>
													<span>{item.name}</span>
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
												className="bg-brand-primary-light hover:bg-brand-primary text-brand-primary hover:text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs gap-2 shrink-0"
												disabled={isLoading}
												isLoading={isItemUpgrading}
												loadingText="Upgrading..."
												onClick={() => onUpgrade(item.name)}
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
