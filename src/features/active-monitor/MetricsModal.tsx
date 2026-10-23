import React, { useState, useEffect } from "react";
import { BrewService, isServiceRunning } from "../../core/types/brew";
import { X, Cpu, HardDrive, Play, Square, RotateCw } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../../core/components/Button";

interface MetricsModalProps {
	service: BrewService | null;
	onClose: () => void;
	onStart: (name: string) => void;
	onStop: (name: string) => void;
	onRestart: (name: string) => void;
	isLoading: boolean;
	actionType?: string;
}

export const MetricsModal: React.FC<MetricsModalProps> = ({
	service,
	onClose,
	onStart,
	onStop,
	onRestart,
	isLoading,
	actionType,
}) => {
	if (!service) return null;

	const [isModalStopping, setIsModalStopping] = useState(false);

	const isRunning = isServiceRunning(service.status);
	const isStopping = isModalStopping || (isLoading && (actionType === "stop" || (isRunning && !actionType)));
	const isStarting = isLoading && (actionType === "start" || (!isRunning && !actionType));
	const isRestarting = isLoading && actionType === "restart";

	const showRunningControls = isStopping || (isRunning && !isStarting);

	const handleStopClick = async () => {
		setIsModalStopping(true);
		try {
			await onStop(service.name);
		} finally {
			setIsModalStopping(false);
			onClose();
		}
	};

	// Auto close modal if the service is stopped and not currently performing an action
	useEffect(() => {
		if (!isRunning && !isLoading && !isModalStopping) {
			onClose();
		}
	}, [isRunning, isLoading, isModalStopping, onClose]);

	const cpu = typeof service.cpu === "number" ? service.cpu : 0;
	const memory = typeof service.memory === "number" ? service.memory : 0;

	return (
		<div
			className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none"
			onClick={onClose}
		>
			<motion.div
				className="bg-white rounded-3xl border border-brand-border p-6 shadow-2xl max-w-lg w-full flex flex-col gap-5"
				onClick={(e) => e.stopPropagation()}
				initial={{ opacity: 0, scale: 0.96 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.96 }}
				transition={{ duration: 0.15 }}
			>
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-brand-border">
					<div className="flex items-center gap-2.5">
						<h3 className="text-lg font-bold text-brand-text">
							{service.name}
						</h3>
						{isRunning ? (
							<span className="inline-flex items-center gap-1.5 bg-[#E8F8F0] text-brand-success text-xs font-semibold px-2.5 py-0.5 rounded-full">
								<span className="w-1.5 h-1.5 rounded-full bg-brand-success animate-pulse" />
								<span>Active</span>
							</span>
						) : (
							<span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 text-xs font-medium px-2.5 py-0.5 rounded-full">
								<span>Stopped</span>
							</span>
						)}
					</div>

					<Button
						className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-brand-text flex items-center justify-center transition-colors cursor-pointer"
						onClick={onClose}
						icon={<X size={15} />}
					/>
				</div>

				{/* Process Details Box */}
				<div className="bg-[#F8F9FD] border border-brand-border p-4 rounded-2xl flex flex-col gap-2 text-xs">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<span className="text-brand-muted">Process ID: </span>
							<strong className="text-brand-text font-mono font-semibold">
								{service.pid || "None"}
							</strong>
						</div>
						<div>
							<span className="text-brand-muted">Running User: </span>
							<strong className="text-brand-text font-semibold">
								{service.user || "Current"}
							</strong>
						</div>
					</div>
					{service.file && (
						<div className="text-[11px] text-brand-muted break-all pt-1 border-t border-brand-border/60">
							<span className="font-semibold text-slate-700">Plist: </span>
							{service.file}
						</div>
					)}
				</div>

				{/* Live Gauges */}
				<div className="grid grid-cols-2 gap-3.5">
					<div className="bg-brand-primary-light/50 border border-indigo-100 p-4 rounded-2xl flex flex-col gap-1">
						<span className="text-xs font-semibold text-brand-primary flex items-center gap-1.5">
							<Cpu size={14} /> CPU USAGE
						</span>
						<span className="text-2xl font-bold text-brand-text font-mono mt-1">
							{cpu.toFixed(1)}%
						</span>
						<div className="w-full h-1.5 bg-indigo-100 rounded-full mt-2 overflow-hidden">
							<div
								className="bg-brand-primary h-full rounded-full transition-all"
								style={{ width: `${Math.min(cpu, 100)}%` }}
							/>
						</div>
					</div>

					<div className="bg-[#F3E8FF]/50 border border-purple-100 p-4 rounded-2xl flex flex-col gap-1">
						<span className="text-xs font-semibold text-brand-secondary flex items-center gap-1.5">
							<HardDrive size={14} /> MEMORY USAGE
						</span>
						<span className="text-2xl font-bold text-brand-text font-mono mt-1">
							{memory}{" "}
							<span className="text-xs font-medium text-brand-muted">MB</span>
						</span>
						<div className="w-full h-1.5 bg-purple-100 rounded-full mt-2 overflow-hidden">
							<div
								className="bg-brand-secondary h-full rounded-full transition-all"
								style={{ width: `${Math.min((memory / 2048) * 100, 100)}%` }}
							/>
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2.5 pt-2 border-t border-brand-border">
					{showRunningControls ? (
						<>
							<Button
								className="flex-1 bg-brand-error hover:bg-[#D43D3D] text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
								disabled={isLoading}
								isLoading={isStopping}
								loadingText="Stopping..."
								spinner={<RotateCw size={13} className="animate-spin text-white" />}
								icon={<Square size={13} fill="currentColor" />}
								onClick={handleStopClick}
							>
								Stop Service
							</Button>
							<Button
								className="bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border border-brand-border font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
								disabled={isLoading || isStopping}
								isLoading={isRestarting}
								loadingText="Restarting..."
								spinner={
									<RotateCw
										size={13}
										className="animate-spin text-brand-primary"
									/>
								}
								icon={<RotateCw size={13} />}
								onClick={() => onRestart(service.name)}
							>
								Restart
							</Button>
						</>
					) : (
						<Button
							className="flex-1 bg-brand-success hover:bg-[#138959] text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
							disabled={isLoading}
							isLoading={isStarting}
							loadingText="Starting..."
							spinner={<RotateCw size={13} className="animate-spin text-white" />}
							icon={<Play size={13} fill="currentColor" />}
							onClick={() => onStart(service.name)}
						>
							Start Service
						</Button>
					)}
				</div>
			</motion.div>
		</div>
	);
};
