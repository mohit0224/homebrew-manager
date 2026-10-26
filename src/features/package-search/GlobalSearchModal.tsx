import React, { useState, useEffect, useRef } from "react";
import {
	Search,
	X,
	Download,
	CheckCircle,
	AlertCircle,
	Loader2,
} from "lucide-react";
import { brewApi, SearchResultItem } from "../../core/api/brewApi";
import { CommandLogEntry } from "../../core/types/brew";
import { Button } from "../../core/components/Button";

interface GlobalSearchModalProps {
	isOpen: boolean;
	initialQuery: string;
	onClose: () => void;
	onInstall: (name: string) => void;
	runningActions: Record<string, any>;
	onLog?: (type: CommandLogEntry["type"], text: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
	isOpen,
	initialQuery,
	onClose,
	onInstall,
	runningActions,
	onLog,
}) => {
	const [query, setQuery] = useState(initialQuery);
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Sync initial query when opened
	useEffect(() => {
		if (isOpen) {
			setQuery(initialQuery);
			if (initialQuery.trim()) {
				executeSearch(initialQuery.trim());
			} else {
				setResults([]);
				setError(null);
			}
			setTimeout(() => inputRef.current?.focus(), 50);
		} else {
			// Flush data on close
			setQuery("");
			setResults([]);
			setError(null);
		}
	}, [isOpen, initialQuery]);

	// Handle escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) {
				handleClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen]);

	const executeSearch = async (term: string) => {
		const trimmed = term.trim();
		if (!trimmed) {
			setResults([]);
			setError(null);
			return;
		}
		setIsLoading(true);
		setError(null);
		onLog?.("info", `[Global Search] Searching packages for "${trimmed}"...`);
		try {
			const items = await brewApi.searchPackages(trimmed);
			setResults(items);
			onLog?.(
				"success",
				`[Global Search] Search completed: Found ${items.length} package(s) matching "${trimmed}".`
			);
		} catch (err: any) {
			const msg = err?.message || "Search failed";
			setError(msg);
			setResults([]);
			onLog?.("error", `[Global Search] Search failed for "${trimmed}": ${msg}`);
		} finally {
			setIsLoading(false);
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setQuery(val);
		if (!val.trim()) {
			setResults([]);
			setError(null);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (query.trim()) {
			executeSearch(query);
		} else {
			setResults([]);
		}
	};

	const handleClose = () => {
		setQuery("");
		setResults([]);
		setError(null);
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
			<div
				className="bg-white rounded-3xl border border-brand-border shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[75vh]"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Search Input Bar */}
				<form
					onSubmit={handleSubmit}
					className="flex items-center px-5 py-3.5 border-b border-brand-border gap-2.5"
				>
					<Search size={18} className="text-brand-primary shrink-0" />
					<input
						ref={inputRef}
						type="text"
						className="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-muted focus:outline-none"
						placeholder="Search Homebrew packages, formulae and casks..."
						value={query}
						onChange={handleInputChange}
					/>
					{query.trim() && (
						<Button
							type="button"
							onClick={() => {
								setQuery("");
								setResults([]);
								setError(null);
								inputRef.current?.focus();
							}}
							className="text-brand-muted hover:text-brand-text p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
							title="Clear query"
							icon={<X size={14} />}
						/>
					)}
					<Button
						type="submit"
						disabled={!query.trim()}
						isLoading={isLoading}
						loadingText="Searching..."
						icon={<Search size={13} />}
						spinner={<Loader2 size={13} className="animate-spin text-white" />}
						className="bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
						title="Search Packages"
					>
						Search
					</Button>
					<Button
						type="button"
						onClick={handleClose}
						className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-brand-muted hover:text-brand-text flex items-center justify-center transition-colors cursor-pointer shrink-0"
						title="Close Search (Esc)"
						icon={<X size={16} />}
					/>
				</form>

				{/* Results Body */}
				<div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 min-h-55">
					{error && (
						<div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-2xl text-xs font-medium">
							<AlertCircle size={16} className="shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{!isLoading &&
						!error &&
						results.length === 0 &&
						query.trim() !== "" && (
							<div className="text-center py-12 text-brand-muted flex flex-col items-center gap-2">
								<p className="text-sm font-medium text-brand-text">
									No packages found for "{query}"
								</p>
								<p className="text-xs">
									Try searching for git, node, redis, python or docker.
								</p>
							</div>
						)}

					{!isLoading && !error && query.trim() === "" && (
						<div className="text-center py-12 text-brand-muted flex flex-col items-center gap-3">
							<div className="w-12 h-12 rounded-2xl bg-purple-50 text-brand-primary flex items-center justify-center">
								<Search size={22} />
							</div>
							<div>
								<p className="text-sm font-semibold text-brand-text">
									Quick Package Finder
								</p>
								<p className="text-xs mt-1">
									Type package name and click Search or press Enter.
								</p>
							</div>
							<div className="flex items-center gap-2 flex-wrap justify-center mt-2">
								{["redis", "postgresql@16", "node", "nginx", "docker"].map(
									(pkg) => (
										<Button
											key={pkg}
											type="button"
											onClick={() => {
												setQuery(pkg);
												executeSearch(pkg);
											}}
											className="px-3 py-1 bg-brand-bg hover:bg-brand-primary-light hover:text-brand-primary border border-brand-border rounded-full text-xs font-medium text-brand-muted transition-colors cursor-pointer"
										>
											{pkg}
										</Button>
									),
								)}
							</div>
						</div>
					)}

					{results.map((pkg) => {
						const isInstalling = !!runningActions[pkg.name];
						return (
							<div
								key={pkg.name}
								className="flex items-center justify-between p-3.5 rounded-2xl border border-brand-border hover:border-brand-primary/40 hover:bg-[#F9FAFD] transition-all"
							>
								<div className="flex flex-col min-w-0 pr-3">
									<div className="flex items-center gap-2">
										<span className="font-bold text-sm text-brand-text">
											{pkg.name}
										</span>
										{pkg.version && (
											<span className="text-[11px] font-mono text-brand-muted bg-slate-100 px-2 py-0.5 rounded-md">
												{pkg.version}
											</span>
										)}
										{pkg.is_installed && (
											<span className="text-[10px] font-bold text-brand-success bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100">
												<CheckCircle size={10} /> Installed
											</span>
										)}
									</div>
									{pkg.description && (
										<p className="text-xs text-brand-muted mt-1 line-clamp-1">
											{pkg.description}
										</p>
									)}
								</div>

								<Button
									type="button"
									onClick={() => onInstall(pkg.name)}
									disabled={pkg.is_installed || isInstalling}
									isLoading={isInstalling}
									loadingText="Installing..."
									spinner={<Loader2 size={13} className="animate-spin text-white" />}
									icon={!pkg.is_installed ? <Download size={13} /> : undefined}
									className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
										pkg.is_installed
											? "bg-slate-100 text-brand-muted cursor-not-allowed"
											: isInstalling
												? "bg-brand-primary/60 text-white cursor-wait"
												: "bg-brand-primary hover:bg-brand-primary-hover text-white shadow-xs"
									}`}
								>
									{pkg.is_installed ? "Installed" : "Install"}
								</Button>
							</div>
						);
					})}
				</div>

				{/* Footer info */}
				<div className="px-5 py-3 bg-[#F9FAFD] border-t border-brand-border flex items-center justify-between text-[11px] text-brand-muted">
					<span>
						{results.length > 0
							? `${results.length} package(s) listed`
							: "Press Esc to close"}
					</span>
					<span className="font-medium">Homebrew Global Discovery</span>
				</div>
			</div>
		</div>
	);
};
