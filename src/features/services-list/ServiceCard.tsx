import React from "react";
import { BrewService, isServiceRunning } from "../../core/types/brew";
import {
	Play,
	Square,
	RotateCw,
	BarChart2,
	Cpu,
	HardDrive,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../../core/components/Button";

interface ServiceCardProps {
	service: BrewService;
	isLoading: boolean;
	actionType?: string;
	onStart: (name: string) => void;
	onStop: (name: string) => void;
	onRestart: (name: string) => void;
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
		onInspect,
	}) => {
		const isRunning = isServiceRunning(service.status);
		const isStopping =
			isLoading && (actionType === "stop" || (isRunning && !actionType));
		const isStarting =
			isLoading && (actionType === "start" || (!isRunning && !actionType));
		const isRestarting = isLoading && actionType === "restart";

		const showRunningControls = isStopping || (isRunning && !isStarting);

		return (
			<motion.div
				className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
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
					{isRunning && !isStopping ? (
						<span className="inline-flex items-center gap-1.5 bg-[#E8F8F0] text-brand-success text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
							<span className="w-1.5 h-1.5 rounded-full bg-brand-success animate-pulse" />
							<span>Active</span>
						</span>
					) : service.status === "error" ? (
						<span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
							<span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
							<span>Error</span>
						</span>
					) : (
						<span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 text-xs font-medium px-2.5 py-1 rounded-full shrink-0">
							<span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
							<span>{isStopping ? "Stopping..." : "Stopped"}</span>
						</span>
					)}
				</div>

				{/* Metrics Row */}
				{isRunning && !isStopping ? (
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
							{isStopping ? "Service is stopping..." : "Service is stopped"}
						</span>
					</div>
				)}

				{/* Action Buttons */}
				<div className="flex items-center gap-2 pt-1 border-t border-brand-border/60">
					{showRunningControls ? (
						<>
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
							<Button
								className="w-8 h-8 rounded-xl bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border border-brand-border flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0"
								disabled={isLoading}
								isLoading={isRestarting}
								spinner={
									<RotateCw
										size={13}
										className="animate-spin text-brand-primary"
									/>
								}
								icon={<RotateCw size={13} />}
								onClick={() => onRestart(service.name)}
								title="Restart Service"
							/>
						</>
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

					{/* Inspect Details Button: Restricted when service is not running */}
					<Button
						className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-xs shrink-0 ${
							isRunning && !isStopping
								? "bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border-brand-border cursor-pointer"
								: "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-50"
						}`}
						disabled={!isRunning || isStopping}
						onClick={() => isRunning && !isStopping && onInspect(service)}
						icon={<BarChart2 size={13} />}
						title={
							isRunning && !isStopping
								? "Inspect Details"
								: "Service must be running to view stats"
						}
					/>
				</div>
			</motion.div>
		);
	},
	areServiceCardPropsEqual,
);
