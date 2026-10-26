import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
	Home,
	Package,
	Search,
	RotateCw,
	Settings,
	Terminal,
} from "lucide-react";
import { BrewSystemInfo } from "../types/brew";

export type TabType =
	| "home"
	| "installed"
	| "search"
	| "outdated"
	| "logs"
	| "settings";

interface SidebarProps {
	activeTab?: TabType;
	onTabChange?: (tab: TabType) => void;
	installedCount: number;
	activeCount: number;
	outdatedCount: number;
	hasAppUpdate?: boolean;
	brewInfo?: BrewSystemInfo;
	onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
	installedCount,
	outdatedCount,
	hasAppUpdate,
	brewInfo,
	onTabChange,
}) => {
	const navigate = useNavigate();
	const location = useLocation();

	const navItems = [
		{
			id: "home" as TabType,
			path: "/",
			label: "Home",
			icon: Home,
		},
		{
			id: "installed" as TabType,
			path: "/installed",
			label: "Packages",
			icon: Package,
			badge: installedCount > 0 ? installedCount : undefined,
		},
		{
			id: "search" as TabType,
			path: "/search",
			label: "Search & Install",
			icon: Search,
		},
		{
			id: "outdated" as TabType,
			path: "/outdated",
			label: "Updates",
			icon: RotateCw,
			badge: outdatedCount > 0 ? outdatedCount : undefined,
			badgeColor: "bg-brand-primary text-white",
		},
		{
			id: "logs" as TabType,
			path: "/logs",
			label: "Terminal Logs",
			icon: Terminal,
		},
	];

	return (
		<aside className="w-64 shrink-0 bg-brand-sidebar border-r border-brand-border flex flex-col justify-between p-5 select-none h-full">
			<div className="flex flex-col gap-6">
				{/* App Branding Header */}
				<div className="flex items-center gap-3 px-1 pt-1">
					<img
						src="/favicon-128x128.png"
						alt="Homebrew Manager"
						className="w-10 h-10 object-contain rounded-xl hm-logo shrink-0 drop-shadow-sm"
					/>
					<div className="flex flex-col min-w-0">
						<span className="font-bold text-sm text-brand-text tracking-tight leading-tight">
							HomeBrew Manager
						</span>
						<span className="text-[11px] text-brand-muted truncate">
							Manage your macOS packages
						</span>
					</div>
				</div>

				{/* Navigation List */}
				<nav className="flex flex-col gap-1">
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive =
							item.path === "/"
								? location.pathname === "/"
								: location.pathname.startsWith(item.path);

						return (
							<button
								key={item.id}
								onClick={() => {
									navigate(item.path);
									onTabChange?.(item.id);
								}}
								className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
									isActive
										? "bg-brand-primary-light text-brand-primary font-semibold shadow-xs"
										: "text-brand-muted hover:text-brand-text hover:bg-white/80"
								}`}
							>
								<div className="flex items-center gap-3">
									<Icon
										size={18}
										strokeWidth={isActive ? 2.3 : 1.8}
										className={
											isActive ? "text-brand-primary" : "text-brand-muted"
										}
									/>
									<span>{item.label}</span>
								</div>

								{item.badge !== undefined && (
									<span
										className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
											item.badgeColor || "bg-brand-primary text-white"
										}`}
									>
										{item.badge}
									</span>
								)}
							</button>
						);
					})}

					{/* Settings Nav Item */}
					{(() => {
						const isSettingsActive = location.pathname === "/settings";
						return (
							<button
								onClick={() => {
									navigate("/settings");
									onTabChange?.("settings");
								}}
								className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
									isSettingsActive
										? "bg-brand-primary-light text-brand-primary font-semibold shadow-xs"
										: "text-brand-muted hover:text-brand-text hover:bg-white/80"
								}`}
							>
								<div className="flex items-center gap-3">
									<Settings
										size={18}
										strokeWidth={isSettingsActive ? 2.3 : 1.8}
										className={
											isSettingsActive
												? "text-brand-primary"
												: "text-brand-muted"
										}
									/>
									<span>Settings</span>
								</div>

								{hasAppUpdate && (
									<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-warning text-white">
										Update
									</span>
								)}
							</button>
						);
					})()}
				</nav>
			</div>

			{/* Minimalist Galerin Branding */}
			<div className="bg-white rounded-xl px-3.5 py-2.5 border border-brand-border shadow-xs flex items-center justify-between text-xs select-none">
				<div className="flex items-center gap-1.5">
					<span
						className={`w-1.5 h-1.5 rounded-full ${
							brewInfo?.isActive !== false ? "bg-brand-success" : "bg-rose-500"
						}`}
					/>
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

				<span className="text-[11px] text-brand-muted">
					By{" "}
					<a
						href="https://galerin.in"
						target="_blank"
						rel="noreferrer"
						className="font-semibold text-brand-text hover:text-brand-primary transition-colors hover:underline"
					>
						Galerin
					</a>
				</span>
			</div>
		</aside>
	);
};
