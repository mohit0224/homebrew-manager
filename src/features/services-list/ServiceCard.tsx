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
	onMenuToggle?: (isOpen: boolean) => void;
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
	if (prev.onMenuToggle !== next.onMenuToggle) return false;

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
		onMenuToggle,
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

		const handleToggleMenu = () => {
			setIsMenuOpen((prev) => {
				const next = !prev;
				onMenuToggle?.(next);
				return next;
			});
		};

		const handleCloseMenu = () => {
			setIsMenuOpen(false);
			onMenuToggle?.(false);
		};

		useEffect(() => {
			if (!isMenuOpen) return;

			const handleClickOutside = (event: MouseEvent) => {
				if (
					menuRef.current &&
					!menuRef.current.contains(event.target as Node)
				) {
					handleCloseMenu();
				}
			};

			const handleKeyDown = (event: KeyboardEvent) => {
				if (event.key === "Escape") {
					handleCloseMenu();
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
				className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4 relative"
				initial={false}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.98 }}
				transition={{ duration: 0.15 }}
			>
				{/* Left Section: Icon + Service Name + Status & Inline Metrics */}
				<div className="flex items-center gap-3.5 min-w-0">
					<div
						className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
							isRunning
								? "bg-emerald-50 text-emerald-600 border border-emerald-100"
								: "bg-slate-100 text-slate-500 border border-slate-200"
						}`}
					>
						<Cpu size={20} />
					</div>

					<div className="flex flex-col min-w-0">
						<div className="flex items-center gap-2.5 flex-wrap">
							<span className="font-bold text-base text-brand-text truncate">
								{service.name}
							</span>

							{isRunning && !isStopping && !isUninstalling ? (
								<span className="inline-flex items-center gap-1.5 bg-[#E8F8F0] text-brand-success text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0">
									<span className="w-1.5 h-1.5 rounded-full bg-brand-success animate-pulse" />
									<span>{isRestarting ? "Restarting..." : "Active"}</span>
								</span>
							) : service.status === "error" ? (
								<span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0">
									<span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
									<span>Error</span>
								</span>
							) : (
								<span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0">
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

							<span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
								Service
							</span>
						</div>

						<div className="flex items-center gap-2.5 mt-1 text-xs text-brand-muted flex-wrap">
							{service.pid ? (
								<span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
									PID: <strong className="text-brand-text font-semibold">{service.pid}</strong>
								</span>
							) : null}
							{service.user ? (
								<span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
									User: <strong className="text-brand-text font-semibold">{service.user}</strong>
								</span>
							) : null}
							{isRunning && !isStopping && !isUninstalling ? (
								<div className="flex items-center gap-2">
									<span className="inline-flex items-center gap-1 bg-[#F0FDF4] text-emerald-700 px-2 py-0.5 rounded-md font-mono text-xs font-medium">
										<Cpu size={11} /> {typeof service.cpu === "number" ? `${service.cpu.toFixed(1)}%` : "0%"}
									</span>
									<span className="inline-flex items-center gap-1 bg-[#F0FDF4] text-emerald-700 px-2 py-0.5 rounded-md font-mono text-xs font-medium">
										<HardDrive size={11} /> {typeof service.memory === "number" ? `${service.memory} MB` : "0 MB"}
									</span>
								</div>
							) : (
								<span className="text-xs text-brand-muted">System background daemon</span>
							)}
						</div>
					</div>
				</div>

				{/* Right Section: Action Controls */}
				<div className="flex items-center gap-2 shrink-0">
					{isUninstalling ? (
						<Button
							className="bg-rose-50 text-rose-600 border border-rose-200 font-semibold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
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
							className="bg-brand-primary-light text-brand-primary border border-indigo-200 font-semibold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
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
							className="bg-brand-error hover:bg-[#D43D3D] text-white font-semibold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
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
							className="bg-brand-success hover:bg-[#138959] text-white font-semibold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
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
							className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-xs cursor-pointer ${
								isMenuOpen
									? "bg-brand-primary-light text-brand-primary border-brand-primary/30"
									: "bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border-brand-border"
							}`}
							disabled={isLoading}
							onClick={handleToggleMenu}
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
									className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl border border-brand-border shadow-xl p-1.5 z-50 flex flex-col gap-0.5"
								>
									{/* Stats Option */}
									<button
										type="button"
										disabled={!isRunning || isStopping}
										onClick={() => {
											if (isRunning && !isStopping) {
												handleCloseMenu();
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
													handleCloseMenu();
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
													handleCloseMenu();
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
											handleCloseMenu();
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
