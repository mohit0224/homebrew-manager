import React, { useEffect } from "react";
import { OutdatedItem } from "../../core/api/brewApi";
import {
	ArrowUpCircle,
	RefreshCw,
	CheckCircle2,
	ArrowRight,
	RotateCw,
} from "lucide-react";
import { Button } from "../../core/components/Button";

interface UpgradesViewProps {
	outdated: OutdatedItem[];
	isLoading: boolean;
	runningActions?: Record<string, any>;
	onRefresh: () => void;
	onUpgrade: (name?: string) => void;
}

export const UpgradesView: React.FC<UpgradesViewProps> = ({
	outdated = [],
	isLoading,
	runningActions = {},
	onRefresh,
	onUpgrade,
}) => {
	useEffect(() => {
		// Only check if bootstrap data is not already loaded
		if (outdated.length === 0 && !isLoading) {
			onRefresh();
		}
	}, []);

	const isUpgradingAll = !!runningActions["all"];

	return (
		<div className="max-w-3xl mx-auto flex flex-col gap-6 w-full">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-bold text-brand-text tracking-tight">
						Software Upgrades
					</h2>
					<p className="text-sm text-brand-muted mt-1">
						Review and upgrade outdated Homebrew packages to their latest
						versions.
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
			{isLoading && (!outdated || outdated.length === 0) ? (
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
			) : !outdated || outdated.length === 0 ? (
				<div className="bg-white rounded-3xl border border-brand-border p-16 text-center shadow-xs flex flex-col items-center justify-center">
					<div className="w-14 h-14 rounded-2xl bg-[#E8F8F0] text-brand-success flex items-center justify-center mb-3.5">
						<CheckCircle2 size={32} />
					</div>
					<h3 className="text-base font-bold text-brand-text">
						All Packages are Up to Date
					</h3>
					<p className="text-xs text-brand-muted mt-1 max-w-sm">
						No outdated Homebrew formulae or casks detected. Your development
						environment is fresh.
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{outdated.map((item) => {
						const installed = Array.isArray(item.installed_versions)
							? item.installed_versions
							: Array.isArray((item as any).installedVersions)
								? (item as any).installedVersions
								: [];
						const current =
							item.current_version || (item as any).currentVersion || "latest";

						return (
							<div
								key={item.name}
								className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between gap-4"
							>
								<div className="flex flex-col min-w-0">
									<span className="font-bold text-base text-brand-text">
										{item.name}
									</span>
									<div className="flex items-center gap-2 font-mono text-xs text-brand-muted mt-1">
										<span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md font-medium">
											{installed.join(", ") || "installed"}
										</span>
										<ArrowRight size={12} className="text-brand-muted" />
										<span className="bg-[#E8F8F0] text-brand-success px-2 py-0.5 rounded-md font-medium">
											{current}
										</span>
									</div>
								</div>

								{(() => {
									const isItemUpgrading =
										!!runningActions[item.name] || isUpgradingAll;
									return (
										<Button
											className="bg-brand-primary-light hover:bg-brand-primary text-brand-primary hover:text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs gap-2"
											disabled={isLoading}
											isLoading={isItemUpgrading}
											loadingText="Upgrading..."
											onClick={() => onUpgrade(item.name)}
											icon={<ArrowUpCircle size={13} />}
											spinner={<RotateCw size={13} className="animate-spin" />}
										>
											Upgrade
										</Button>
									);
								})()}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};
