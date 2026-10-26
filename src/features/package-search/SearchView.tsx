import React, { useState, useRef, useCallback, useEffect } from "react";
import { SearchResultItem } from "../../core/api/brewApi";
import { useVirtualizer } from "../../core/hooks/useVirtualList";
import {
	Search,
	Download,
	CheckCircle,
	AlertCircle,
	Sparkles,
	RotateCw,
	X,
	AppWindow,
	Package,
} from "lucide-react";
import { Button } from "../../core/components/Button";

interface SearchViewProps {
	onSearch: (query: string) => void;
	onInstall: (name: string, isCask?: boolean) => void;
	results: SearchResultItem[];
	isSearching: boolean;
	searchError: string | null;
	runningActions: Record<string, any>;
}

const ROW_GAP = 12;
const OVERSCAN_COUNT = 5;

const QUICK_SUGGESTIONS = [
	"redis",
	"elasticsearch",
	"postgresql@16",
	"nginx",
	"rabbitmq",
	"kafka",
	"mongodb-community",
];

export const SearchView: React.FC<SearchViewProps> = ({
	onSearch,
	onInstall,
	results,
	isSearching,
	searchError,
	runningActions,
}) => {
	const scrollParentRef = useRef<HTMLDivElement | null>(null);
	const [inputVal, setInputVal] = useState("");

	const getScrollElement = useCallback(() => scrollParentRef.current, []);
	const estimateSize = useCallback(
		(index: number) => (results[index]?.description ? 92 : 68),
		[results],
	);
	const getItemKey = useCallback(
		(index: number) => {
			const item = results[index];
			return item ? `${item.packageType || "pkg"}-${item.name}` : index;
		},
		[results],
	);

	const rowVirtualizer = useVirtualizer({
		count: results.length,
		getScrollElement,
		estimateSize,
		overscan: OVERSCAN_COUNT,
		gap: ROW_GAP,
		getItemKey,
	});

	const virtualItems = rowVirtualizer.getVirtualItems();
	const totalSize = rowVirtualizer.getTotalSize();

	// Reset scroll position to top whenever search results update
	useEffect(() => {
		if (scrollParentRef.current) {
			scrollParentRef.current.scrollTop = 0;
		}
		rowVirtualizer.scrollToOffset(0);
	}, [results]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (inputVal.trim()) {
			onSearch(inputVal.trim());
		} else {
			onSearch("");
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setInputVal(val);
		if (!val.trim()) {
			onSearch("");
		}
	};

	const handleClearInput = () => {
		setInputVal("");
		onSearch("");
	};

	const handleSuggestionClick = (pkg: string) => {
		setInputVal(pkg);
		onSearch(pkg);
	};

	return (
		<div className="max-w-3xl mx-auto flex flex-col gap-6 w-full">
			{/* Search Header */}
			<div className="text-center">
				<h2 className="text-2xl font-bold text-brand-text tracking-tight">
					Discover and Install Packages
				</h2>
				<p className="text-sm text-brand-muted mt-1.5">
					Search millions of Homebrew formulae and casks with instant
					sanitization.
				</p>
			</div>

			{/* Search Input Bar */}
			<form onSubmit={handleSubmit} className="flex gap-3 items-center">
				<div className="flex-1 flex items-center bg-white border border-brand-border rounded-2xl px-4 py-3 shadow-xs focus-within:ring-2 focus-within:ring-brand-primary/20 focus-within:border-brand-primary transition-all">
					<Search
						size={18}
						className="text-brand-muted shrink-0 mr-3"
					/>
					<input
						type="text"
						className="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-muted focus:outline-none"
						placeholder="Search package (e.g. redis, elasticsearch, nginx)..."
						value={inputVal}
						onChange={handleInputChange}
					/>
					{inputVal && (
						<Button
							type="button"
							onClick={handleClearInput}
							className="text-brand-muted hover:text-brand-text p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ml-1.5"
							title="Clear input"
							icon={<X size={15} />}
						/>
					)}
				</div>
				<Button
					type="submit"
					disabled={!inputVal.trim()}
					className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold text-sm px-6 py-3 rounded-2xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-primary"
					isLoading={isSearching}
					loadingText="Searching..."
					spinner={<RotateCw size={15} className="animate-spin text-white" />}
				>
					Search
				</Button>
			</form>

			{/* Quick Suggestions Chips */}
			<div className="flex items-center gap-2 flex-wrap">
				<span className="text-xs text-brand-muted flex items-center gap-1 mr-1">
					<Sparkles size={13} className="text-brand-primary" /> Popular:
				</span>
				{QUICK_SUGGESTIONS.map((pkg) => (
					<Button
						key={pkg}
						type="button"
						onClick={() => handleSuggestionClick(pkg)}
						className="bg-white hover:bg-brand-primary-light hover:text-brand-primary border border-brand-border px-3 py-1 rounded-full text-xs font-medium text-brand-muted transition-colors cursor-pointer shadow-xs"
					>
						{pkg}
					</Button>
				))}
			</div>

			{/* Error Message */}
			{searchError && (
				<div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-2xl text-xs font-medium">
					<AlertCircle size={16} className="shrink-0" />
					<span>{searchError}</span>
				</div>
			)}

			{/* Results List */}
			{results.length > 0 && (
				<div
					ref={scrollParentRef}
					role="region"
					aria-label="Search results list"
					className="max-h-[calc(100vh-320px)] min-h-60 overflow-y-auto pr-1 select-none"
				>
					<div className="relative w-full" style={{ height: `${totalSize}px` }}>
						{virtualItems.map((virtualRow) => {
							const item = results[virtualRow.index];
							if (!item) return null;

							const isInstalling = !!runningActions[item.name];
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
												<div
													className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
														isCask
															? "bg-purple-50 text-purple-600"
															: "bg-blue-50 text-blue-600"
													}`}
												>
													{isCask ? <AppWindow size={15} /> : <Package size={15} />}
												</div>

												<span className="font-bold text-base text-brand-text">
													{item.name}
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
											</div>
											{item.description && (
												<p className="text-xs text-brand-muted mt-1.5 line-clamp-2">
													{item.description}
												</p>
											)}
										</div>

										<div className="shrink-0">
											{item.is_installed ? (
												<span className="bg-slate-100 text-slate-500 font-medium text-xs px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-default select-none border border-slate-200/60">
													<CheckCircle size={12} className="text-emerald-500" />
													Installed
												</span>
											) : (
												<Button
													className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
													disabled={isInstalling}
													isLoading={isInstalling}
													loadingText="Installing..."
													spinner={
														<RotateCw size={13} className="animate-spin text-white" />
													}
													icon={<Download size={13} />}
													onClick={() => onInstall(item.name, isCask)}
												>
													Install
												</Button>
											)}
										</div>
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
