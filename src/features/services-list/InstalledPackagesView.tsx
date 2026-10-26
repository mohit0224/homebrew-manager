import React, { useState, useMemo, useRef, useCallback } from "react";
import { BrewService } from "../../core/types/brew";
import { InstalledPackageItem } from "../../core/api/brewApi";
import { ServiceCard } from "./ServiceCard";
import { useVirtualizer } from "../../core/hooks/useVirtualList";
import {
	AppWindow,
	Trash2,
	RotateCw,
	Filter,
} from "lucide-react";
import { Button } from "../../core/components/Button";

interface InstalledPackagesViewProps {
	services: BrewService[];
	installedPackages?: InstalledPackageItem[];
	filterText: string;
	runningActions: Record<string, any>;
	onStart: (name: string) => void;
	onStop: (name: string) => void;
	onRestart: (name: string) => void;
	onUninstall: (name: string, isCask?: boolean) => void;
	onInspect: (service: BrewService) => void;
	onUpgrade?: (name: string, isCask?: boolean) => void;
}

type FilterTab = "services" | "casks";

interface MergedItem {
	key: string;
	name: string;
	packageType: "cask" | "service";
	version: string;
	service?: BrewService;
}

const ESTIMATED_ROW_HEIGHT = 86;
const ROW_GAP = 12;
const OVERSCAN_COUNT = 5;
const PACKAGES_SNAPSHOT_KEY = "homebrew_installed_packages_virtual_list";

export const InstalledPackagesView: React.FC<InstalledPackagesViewProps> = React.memo(({
	services,
	installedPackages = [],
	filterText,
	runningActions,
	onStart,
	onStop,
	onRestart,
	onUninstall,
	onInspect,
}) => {
	const scrollParentRef = useRef<HTMLDivElement | null>(null);

	// Default to Background Services tab
	const [activeTab, setActiveTab] = useState<FilterTab>("services");

	// 1. Merge only services and cask packages
	const allItems = useMemo<MergedItem[]>(() => {
		const items: MergedItem[] = [];
		const addedNames = new Set<string>();

		// Add services
		for (const svc of services) {
			if (!svc?.name) continue;
			addedNames.add(svc.name.toLowerCase());
			items.push({
				key: `service-${svc.name}`,
				name: svc.name,
				packageType: "service",
				version: svc.status,
				service: svc,
			});
		}

		// Add only Cask packages (desktop apps)
		for (const pkg of installedPackages) {
			if (!pkg?.name || pkg.packageType !== "cask") continue;
			const lower = pkg.name.toLowerCase();
			if (addedNames.has(lower)) continue;
			addedNames.add(lower);

			const versions = Array.isArray(pkg.installed_versions)
				? pkg.installed_versions
				: Array.isArray(pkg.installedVersions)
					? pkg.installedVersions
					: [];
			const ver = versions.length > 0 ? versions[versions.length - 1] : "latest";

			items.push({
				key: `cask-${pkg.name}`,
				name: pkg.name,
				packageType: "cask",
				version: ver,
			});
		}

		return items.sort((a, b) => a.name.localeCompare(b.name));
	}, [services, installedPackages]);

	// 2. Tab counts
	const counts = useMemo(() => {
		let casks = 0;
		let svcCount = 0;

		for (const item of allItems) {
			if (item.packageType === "cask") casks++;
			else if (item.packageType === "service") svcCount++;
		}

		return {
			casks,
			services: svcCount,
		};
	}, [allItems]);

	// 3. Filter by search text and active tab
	const filteredItems = useMemo(() => {
		const query = filterText.toLowerCase();
		return allItems.filter((item) => {
			const matchesText = item.name.toLowerCase().includes(query);
			if (!matchesText) return false;

			if (activeTab === "casks") return item.packageType === "cask";
			if (activeTab === "services") return item.packageType === "service";
			return true;
		});
	}, [allItems, filterText, activeTab]);

	const getScrollElement = useCallback(() => scrollParentRef.current, []);
	const estimateSize = useCallback(() => ESTIMATED_ROW_HEIGHT, []);
	const getItemKey = useCallback(
		(index: number) => filteredItems[index]?.key ?? index,
		[filteredItems],
	);

	const rowVirtualizer = useVirtualizer({
		count: filteredItems.length,
		getScrollElement,
		estimateSize,
		overscan: OVERSCAN_COUNT,
		gap: ROW_GAP,
		getItemKey,
		snapshotKey: PACKAGES_SNAPSHOT_KEY,
	});

	const virtualItems = rowVirtualizer.getVirtualItems();
	const totalSize = rowVirtualizer.getTotalSize();

	return (
		<div className="flex flex-col gap-5">
			{/* Filter Tabs Bar (Background Services by default, and Casks) */}
			<div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-brand-border rounded-2xl p-2 shadow-xs">
				<div className="flex items-center gap-2 flex-wrap">
					<button
						type="button"
						onClick={() => setActiveTab("services")}
						className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
							activeTab === "services"
								? "bg-emerald-600 text-white shadow-xs"
								: "text-brand-muted hover:text-emerald-600 hover:bg-emerald-50"
						}`}
					>
						<Filter size={13} />
						<span>Background Services</span>
						<span
							className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
								activeTab === "services"
									? "bg-white/20 text-white"
									: "bg-emerald-100 text-emerald-700"
							}`}
						>
							{counts.services}
						</span>
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("casks")}
						className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
							activeTab === "casks"
								? "bg-purple-600 text-white shadow-xs"
								: "text-brand-muted hover:text-purple-600 hover:bg-purple-50"
						}`}
					>
						<AppWindow size={13} />
						<span>Casks (Desktop Apps)</span>
						<span
							className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
								activeTab === "casks"
									? "bg-white/20 text-white"
									: "bg-purple-100 text-purple-700"
							}`}
						>
							{counts.casks}
						</span>
					</button>
				</div>

				<div className="text-xs text-brand-muted px-2 font-medium">
					Showing <strong>{filteredItems.length}</strong> of{" "}
					<strong>{activeTab === "services" ? counts.services : counts.casks}</strong>{" "}
					{activeTab === "services" ? "services" : "cask applications"}
				</div>
			</div>

			{/* Product-owned Scroll Surface & Virtualized Runway */}
			{filteredItems.length === 0 ? (
				<div className="bg-white rounded-2xl border border-brand-border py-16 px-6 text-center text-sm text-brand-muted shadow-xs">
					{activeTab === "services"
						? `No background services found matching "${filterText}".`
						: `No cask desktop applications found matching "${filterText}".`}
				</div>
			) : (
				<div
					ref={scrollParentRef}
					role="region"
					aria-label="Installed packages and services list"
					className="h-[calc(100vh-270px)] min-h-96 overflow-y-auto pr-1 select-none"
				>
					<div className="relative w-full" style={{ height: `${totalSize}px` }}>
						{virtualItems.map((virtualRow) => {
							const item = filteredItems[virtualRow.index];
							if (!item) return null;

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
									{item.service ? (
										<ServiceCard
											service={item.service}
											isLoading={!!runningActions[item.name]}
											actionType={
												typeof runningActions[item.name] === "string"
													? (runningActions[item.name] as string)
													: undefined
											}
											onStart={onStart}
											onStop={onStop}
											onRestart={onRestart}
											onUninstall={(name) => onUninstall(name, false)}
											onInspect={onInspect}
										/>
									) : (
										<div className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between gap-4">
											<div className="flex items-center gap-3.5 min-w-0">
												<div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-purple-50 text-purple-600 border border-purple-100">
													<AppWindow size={20} />
												</div>

												<div className="flex flex-col min-w-0">
													<div className="flex items-center gap-2.5 flex-wrap">
														<span
															className="font-bold text-base text-brand-text truncate"
															title={item.name}
														>
															{item.name}
														</span>
														<span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200">
															Cask
														</span>
														<span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#E8F8F0] text-brand-success px-2.5 py-0.5 rounded-full">
															Installed
														</span>
													</div>
													<div className="flex items-center gap-2 mt-1 text-xs text-brand-muted flex-wrap">
														<span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
															{item.version.startsWith("v") ? item.version : `v${item.version}`}
														</span>
														<span>•</span>
														<span>Desktop Application</span>
													</div>
												</div>
											</div>

											<div className="flex items-center gap-2 shrink-0">
												<Button
													type="button"
													onClick={() => onUninstall(item.name, true)}
													disabled={runningActions[item.name] === "uninstall"}
													isLoading={runningActions[item.name] === "uninstall"}
													loadingText="Uninstalling..."
													spinner={<RotateCw size={13} className="animate-spin text-rose-600" />}
													icon={<Trash2 size={13} />}
													className="px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
													title={`Uninstall ${item.name}`}
												>
													Uninstall
												</Button>
											</div>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
});
