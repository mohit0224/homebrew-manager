import React from "react";
import { useLocation } from "react-router-dom";
import { Search, RotateCw } from "lucide-react";
import { TabType } from "./Sidebar";
import { Button } from "./Button";

interface HeaderProps {
	activeTab?: TabType;
	filterText: string;
	onFilterChange: (text: string) => void;
	onRefresh: () => void;
	onOpenSettings?: () => void;
	onOpenSearch?: (query?: string) => void;
	isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
	activeTab,
	filterText,
	onFilterChange,
	onRefresh,
	onOpenSearch,
	isRefreshing,
}) => {
	const location = useLocation();

	const titles: Record<string, { title: string }> = {
		"/": {
			title: "Home",
		},
		"/installed": {
			title: "Installed Packages",
		},
		"/search": {
			title: "Search & Install",
		},
		"/outdated": {
			title: "Software Updates",
		},
		"/active": {
			title: "Active Services",
		},
		"/logs": {
			title: "Terminal Logs",
		},
		"/settings": {
			title: "Settings",
		},
	};

	const currentInfo =
		titles[location.pathname] ||
		(activeTab && titles[`/${activeTab}`]) ||
		titles["/"];
	const { title } = currentInfo;

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				onOpenSearch?.(filterText);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [filterText, onOpenSearch]);

	return (
		<header className="flex flex-col min-[1060px]:flex-row min-[1060px]:items-center justify-between gap-4 pb-6 select-none shrink-0 transition-all">
			{/* Title & Subtitle */}
			<div className="flex flex-col min-w-0">
				<h1 className="text-2xl font-bold text-brand-text tracking-tight">
					{title}
				</h1>
				<p className="text-sm text-brand-muted mt-1 leading-relaxed min-[1060px]:truncate">
					Everything you need to manage Homebrew, in one place.
				</p>
			</div>

			{/* Controls: Search Bar & Refresh Button */}
			<div className="flex items-center gap-3 w-full min-[1060px]:w-auto min-[1060px]:shrink-0">
				{/* Search Bar matching reference image */}

				<div className="relative flex-1 w-full min-[1060px]:w-72 min-[1060px]:flex-initial flex items-center">
					<Search
						size={16}
						className="absolute left-3.5 text-brand-muted pointer-events-none"
					/>

					<input
						type="text"
						className="w-full bg-white border border-brand-border rounded-xl pl-9 pr-17 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary shadow-xs transition-all cursor-pointer"
						placeholder="Search packages, e.g. node, git, python..."
						value={filterText}
						onChange={(e) => {
							const val = e.target.value;
							onFilterChange(val);
							if (val.trim()) {
								onOpenSearch?.(val);
							}
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								onOpenSearch?.(filterText);
							}
						}}
						onClick={() => onOpenSearch?.(filterText)}
					/>

					<span className="absolute right-2 inline-flex items-center gap-1 rounded-md border border-brand-border bg-brand-bg/80 px-1.5 py-1 text-[10px] font-medium leading-none text-brand-muted shadow-xs pointer-events-none select-none">
						<kbd className="font-sans">⌘</kbd>
						<span className="opacity-60">+</span>
						<kbd className="font-sans">K</kbd>
					</span>
				</div>

				{/* Refresh Services */}
				<Button
					className="w-9 h-9 rounded-xl bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border border-brand-border flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0"
					onClick={onRefresh}
					isLoading={isRefreshing}
					spinner={
						<RotateCw size={15} className="animate-spin text-brand-primary" />
					}
					icon={<RotateCw size={15} />}
					title={
						isRefreshing ? "Refreshing Environment..." : "Refresh Environment"
					}
				/>
			</div>
		</header>
	);
};
