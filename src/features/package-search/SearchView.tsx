import React, { useState } from "react";
import { SearchResultItem } from "../../core/api/brewApi";
import {
	Search,
	Download,
	CheckCircle,
	AlertCircle,
	Sparkles,
	RotateCw,
	X,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../../core/components/Button";

interface SearchViewProps {
	onSearch: (query: string) => void;
	onInstall: (name: string) => void;
	results: SearchResultItem[];
	isSearching: boolean;
	searchError: string | null;
	runningActions: Record<string, any>;
}

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
	const [inputVal, setInputVal] = useState("");

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
			<div className="flex flex-col gap-3">
				{results.map((item) => {
					const isInstalling = !!runningActions[item.name];

					return (
						<motion.div
							key={item.name}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between gap-4"
						>
							<div className="flex flex-col min-w-0">
								<div className="flex items-center gap-2.5">
									<span className="font-bold text-base text-brand-text">
										{item.name}
									</span>
									{item.is_installed && (
										<span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#E8F8F0] text-brand-success px-2 py-0.5 rounded-full">
											<CheckCircle size={11} /> Installed
										</span>
									)}
								</div>
								{item.description && (
									<p className="text-xs text-brand-muted mt-1 line-clamp-2">
										{item.description}
									</p>
								)}
							</div>

							<div className="shrink-0">
								{item.is_installed ? (
									<span className="bg-slate-100 text-slate-500 font-medium text-xs px-3.5 py-2 rounded-xl inline-block cursor-default">
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
										onClick={() => onInstall(item.name)}
									>
										Install
									</Button>
								)}
							</div>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
};
