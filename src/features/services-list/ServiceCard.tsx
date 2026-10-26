import React, { useState, useRef, useEffect } from "react";
import { BrewService, isServiceRunning } from "../../core/types/brew";
import {
	Play,
	Square,
	RotateCw,
	BarChart2,
	Cpu,
	HardDrive,
	Trash2,
	MoreHorizontal,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../../core/components/Button";

interface ServiceCardProps {
	service: BrewService;
	isLoading: boolean;
	actionType?: string;
	onStart: (name: string) => void;
	onStop: (name: string) => void;
	onRestart: (name: string) => void;
	onUninstall: (name: string) => void;
	onInspect: (service: BrewService) => void;
}

function areServiceCardPropsEqual(
	prev: ServiceCardProps,
	next: ServiceCardProps,
): boolean {
	if (prev.isLoading !== next.isLoading) return false;
	if (prev.actionType !== next.actionType) return false;
	if (prev.onStart !== next.onStart) return false;
	if (prev.onStop !== next.onStop) return false;
	if (prev.onRestart !== next.onRestart) return false;
	if (prev.onUninstall !== next.onUninstall) return false;
	if (prev.onInspect !== next.onInspect) return false;

	const p = prev.service;
	const n = next.service;
	if (p === n) return true;

	return (
		p.name === n.name &&
		p.status === n.status &&
		p.pid === n.pid &&
		p.user === n.user &&
		p.cpu === n.cpu &&
		p.memory === n.memory
	);
}

export const ServiceCard: React.FC<ServiceCardProps> = React.memo(
	({
		service,
		isLoading,
		actionType,
		onStart,
		onStop,
		onRestart,
		onUninstall,
		onInspect,
	}) => {
		const [isMenuOpen, setIsMenuOpen] = useState(false);
		const menuRef = useRef<HTMLDivElement>(null);

		const isRunning = isServiceRunning(service.status);
		const isStopping =
			isLoading && (actionType === "stop" || (isRunning && !actionType));
		const isStarting =
			isLoading && (actionType === "start" || (!isRunning && !actionType));
		const isRestarting = isLoading && actionType === "restart";
		const isUninstalling = isLoading && actionType === "uninstall";

		const showRunningControls = isStopping || (isRunning && !isStarting);

		useEffect(() => {
			if (!isMenuOpen) return;

			const handleClickOutside = (event: MouseEvent) => {
				if (
					menuRef.current &&
					!menuRef.current.contains(event.target as Node)
				) {
					setIsMenuOpen(false);
				}
			};

			const handleKeyDown = (event: KeyboardEvent) => {
				if (event.key === "Escape") {
					setIsMenuOpen(false);
				}
			};

			document.addEventListener("mousedown", handleClickOutside);
			window.addEventListener("keydown", handleKeyDown);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
				window.removeEventListener("keydown", handleKeyDown);
			};
		}, [isMenuOpen]);

		return (
			<motion.div
				className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 relative"
				layout
				initial={false}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.98 }}
				transition={{ duration: 0.15 }}
			>
				{/* Top Header */}
				<div className="flex items-start justify-between gap-3">
					<div className="flex flex-col min-w-0">
						<span className="font-bold text-base text-brand-text truncate">
							{service.name}
						</span>
						<div className="flex items-center gap-2 mt-1 text-xs text-brand-muted">
							{service.pid ? (
								<span>
									PID:{" "}
									<strong className="text-brand-text font-semibold">
										{service.pid}
									</strong>
								</span>
							) : null}
							{service.user ? (
								<span>
									User:{" "}
									<strong className="text-brand-text font-semibold">
										{service.user}
									</strong>
								</span>
							) : null}
							{!service.pid && !service.user ? (
								<span>System daemon</span>
							) : null}
						</div>
					</div>

					{/* Status Badge */}
					{isRunning && !isStopping && !isUninstalling ? (
						<span className="inline-flex items-center gap-1.5 bg-[#E8F8F0] text-brand-success text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
							<span className="w-1.5 h-1.5 rounded-full bg-brand-success animate-pulse" />
							<span>{isRestarting ? "Restarting..." : "Active"}</span>
						</span>
					) : service.status === "error" ? (
						<span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
							<span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
							<span>Error</span>
						</span>
					) : (
						<span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 text-xs font-medium px-2.5 py-1 rounded-full shrink-0">
							<span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
							<span>
								{isUninstalling
									? "Uninstalling..."
									: isStopping
										? "Stopping..."
										: "Stopped"}
							</span>
						</span>
					)}
				</div>

				{/* Metrics Row */}
				{isRunning && !isStopping && !isUninstalling ? (
					<div className="grid grid-cols-2 gap-2.5">
						<div className="bg-[#F8F9FD] rounded-xl p-2.5 border border-brand-border flex flex-col gap-0.5">
							<span className="text-[11px] font-medium text-brand-muted flex items-center gap-1">
								<Cpu size={12} className="text-brand-primary" /> CPU
							</span>
							<span className="text-sm font-bold text-brand-text">
								{typeof service.cpu === "number"
									? `${service.cpu.toFixed(1)}%`
									: "0.0%"}
							</span>
						</div>

						<div className="bg-[#F8F9FD] rounded-xl p-2.5 border border-brand-border flex flex-col gap-0.5">
							<span className="text-[11px] font-medium text-brand-muted flex items-center gap-1">
								<HardDrive size={12} className="text-brand-secondary" /> RAM
							</span>
							<span className="text-sm font-bold text-brand-text">
								{typeof service.memory === "number"
									? `${service.memory} MB`
									: "0 MB"}
							</span>
						</div>
					</div>
				) : (
					<div className="bg-[#F8F9FD] rounded-xl p-2.5 border border-brand-border text-center">
						<span className="text-xs text-brand-muted">
							{isUninstalling
								? "Uninstalling package..."
								: isStopping
									? "Service is stopping..."
									: "Service is stopped"}
						</span>
					</div>
				)}

				{/* Action Buttons: Main Action + 3-Dots Dropdown Menu */}
				<div className="flex items-center gap-2 pt-1 border-t border-brand-border/60">
					{isUninstalling ? (
						<Button
							className="flex-1 bg-rose-50 text-rose-600 border border-rose-200 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
							disabled
							isLoading
							loadingText="Uninstalling..."
							spinner={
								<RotateCw size={13} className="animate-spin text-rose-600" />
							}
						>
							Uninstalling...
						</Button>
					) : isRestarting ? (
						<Button
							className="flex-1 bg-brand-primary-light text-brand-primary border border-indigo-200 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
							disabled
							isLoading
							loadingText="Restarting..."
							spinner={
								<RotateCw
									size={13}
									className="animate-spin text-brand-primary"
								/>
							}
						>
							Restarting...
						</Button>
					) : showRunningControls ? (
						<Button
							className="flex-1 bg-brand-error hover:bg-[#D43D3D] text-white font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
							disabled={isLoading}
							isLoading={isStopping}
							loadingText="Stopping..."
							spinner={
								<RotateCw size={13} className="animate-spin text-white" />
							}
							icon={<Square size={13} fill="currentColor" />}
							onClick={() => onStop(service.name)}
						>
							Stop
						</Button>
					) : (
						<Button
							className="flex-1 bg-brand-success hover:bg-[#138959] text-white font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
							disabled={isLoading}
							isLoading={isStarting}
							loadingText="Starting..."
							spinner={
								<RotateCw size={13} className="animate-spin text-white" />
							}
							icon={<Play size={13} fill="currentColor" />}
							onClick={() => onStart(service.name)}
						>
							Start
						</Button>
					)}

					{/* 3-Dots Dropdown Menu Container */}
					<div className="relative shrink-0" ref={menuRef}>
						<Button
							className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-xs cursor-pointer ${
								isMenuOpen
									? "bg-brand-primary-light text-brand-primary border-brand-primary/30"
									: "bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border-brand-border"
							}`}
							disabled={isLoading}
							onClick={() => setIsMenuOpen((prev) => !prev)}
							icon={<MoreHorizontal size={15} />}
							title="More Options"
						/>

						<AnimatePresence>
							{isMenuOpen && (
								<motion.div
									initial={{ opacity: 0, scale: 0.95, y: 4 }}
									animate={{ opacity: 1, scale: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.95, y: 4 }}
									transition={{ duration: 0.12 }}
									className="absolute right-0 bottom-full mb-2 w-44 bg-white rounded-2xl border border-brand-border shadow-xl p-1.5 z-30 flex flex-col gap-0.5"
								>
									{/* Stats Option */}
									<button
										type="button"
										disabled={!isRunning || isStopping}
										onClick={() => {
											if (isRunning && !isStopping) {
												setIsMenuOpen(false);
												onInspect(service);
											}
										}}
										className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
											isRunning && !isStopping
												? "text-brand-text hover:bg-[#F8F9FD] cursor-pointer"
												: "text-slate-300 cursor-not-allowed"
										}`}
										title={
											isRunning && !isStopping
												? "Inspect Service Stats"
												: "Start service to view stats"
										}
									>
										<BarChart2 size={14} className="shrink-0" />
										<span>Stats</span>
									</button>

									{/* Running Service Options: Restart & Stop */}
									{showRunningControls && (
										<>
											<button
												type="button"
												onClick={() => {
													setIsMenuOpen(false);
													onRestart(service.name);
												}}
												className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-brand-text hover:bg-[#F8F9FD] text-left transition-colors cursor-pointer"
											>
												<RotateCw size={14} className="shrink-0" />
												<span>Restart</span>
											</button>

											<button
												type="button"
												onClick={() => {
													setIsMenuOpen(false);
													onStop(service.name);
												}}
												className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-brand-text hover:bg-[#F8F9FD] text-left transition-colors cursor-pointer"
											>
												<Square size={14} className="shrink-0" />
												<span>Stop</span>
											</button>
										</>
									)}

									<div className="my-0.5 border-t border-brand-border/60" />

									{/* Uninstall Option */}
									<button
										type="button"
										onClick={() => {
											setIsMenuOpen(false);
											onUninstall(service.name);
										}}
										className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 text-left transition-colors cursor-pointer"
									>
										<Trash2 size={14} className="shrink-0" />
										<span>Uninstall</span>
									</button>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</motion.div>
		);
	},
	areServiceCardPropsEqual,
);
