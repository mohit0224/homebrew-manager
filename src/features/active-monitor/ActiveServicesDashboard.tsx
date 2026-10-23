import React from "react";
import { BrewService, isServiceRunning } from "../../core/types/brew";
import {
	Activity,
	Cpu,
	HardDrive,
	Square,
	RotateCw,
	BarChart2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../../core/components/Button";

interface ActiveServicesDashboardProps {
	services: BrewService[];
	runningActions: Record<string, any>;
	onStop: (name: string) => void;
	onRestart: (name: string) => void;
	onInspect: (service: BrewService) => void;
}

export const ActiveServicesDashboard: React.FC<
	ActiveServicesDashboardProps
> = ({ services, runningActions, onStop, onRestart, onInspect }) => {
	const activeServices = services.filter((s) => isServiceRunning(s.status));

	const totalServiceMemory = activeServices.reduce(
		(sum, s) => sum + (typeof s.memory === "number" ? s.memory : 0),
		0,
	);
	const totalServiceCpu = activeServices.reduce(
		(sum, s) => sum + (typeof s.cpu === "number" ? s.cpu : 0),
		0,
	);

	if (activeServices.length === 0) {
		return (
			<div className="bg-white rounded-3xl border border-brand-border p-16 text-center shadow-xs flex flex-col items-center justify-center max-w-2xl mx-auto my-8">
				<div className="w-14 h-14 rounded-2xl bg-emerald-50 text-brand-success flex items-center justify-center mb-3.5">
					<Activity size={32} />
				</div>
				<h3 className="text-base font-bold text-brand-text">
					No Active Background Services
				</h3>
				<p className="text-xs text-brand-muted mt-1 max-w-md">
					Services started via Homebrew (like Redis, PostgreSQL, MongoDB) will
					appear here with live metrics.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 w-full">
			{/* Overview Stats Bar */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* Card 1 */}
				<div className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs flex flex-col gap-1">
					<div className="flex items-center gap-2 text-xs font-semibold text-brand-success">
						<Activity size={15} />
						<span>ACTIVE SERVICES</span>
					</div>
					<span className="text-2xl font-bold text-brand-text mt-1">
						{activeServices.length}
					</span>
				</div>

				{/* Card 2 */}
				<div className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs flex flex-col gap-1">
					<div className="flex items-center gap-2 text-xs font-semibold text-brand-primary">
						<Cpu size={15} />
						<span>TOTAL SERVICES CPU</span>
					</div>
					<span className="text-2xl font-bold text-brand-text font-mono mt-1">
						{totalServiceCpu.toFixed(1)}%
					</span>
				</div>

				{/* Card 3 */}
				<div className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs flex flex-col gap-1">
					<div className="flex items-center gap-2 text-xs font-semibold text-[#8B7CF6]">
						<HardDrive size={15} />
						<span>TOTAL SERVICES RAM</span>
					</div>
					<span className="text-2xl font-bold text-brand-text font-mono mt-1">
						{totalServiceMemory} MB
					</span>
				</div>
			</div>

			{/* Control Center Tiles */}
			<div className="flex flex-col gap-3">
				<h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider">
					Live Service Tiles
				</h3>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{activeServices.map((service) => {
						const isLoading = !!runningActions[service.name];
						const actionType = runningActions[service.name];
						const isStopping =
							isLoading && (actionType === "stop" || !actionType);
						const isRestarting = isLoading && actionType === "restart";
						const cpuVal = typeof service.cpu === "number" ? service.cpu : 0;
						const ramVal =
							typeof service.memory === "number" ? service.memory : 0;

						return (
							<motion.div
								key={service.name}
								layout
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.15 }}
								className="bg-white rounded-2xl border border-brand-border p-5 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between gap-4"
							>
								<div className="flex flex-col min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="w-2 h-2 rounded-full bg-brand-success animate-pulse shrink-0" />
										<span className="font-bold text-base text-brand-text truncate">
											{service.name}
										</span>
									</div>

									<div className="flex items-center gap-3 mt-1.5 text-xs text-brand-muted font-mono">
										<span>
											CPU:{" "}
											<strong className="text-brand-primary font-semibold">
												{cpuVal.toFixed(1)}%
											</strong>
										</span>
										<span>
											RAM:{" "}
											<strong className="text-[#8B7CF6] font-semibold">
												{ramVal} MB
											</strong>
										</span>
									</div>

									{service.pid && (
										<span className="text-[11px] text-brand-muted mt-1">
											PID {service.pid}{" "}
											{service.user ? `(${service.user})` : ""}
										</span>
									)}
								</div>

								{/* Actions */}
								<div className="flex items-center gap-2 shrink-0">
									<Button
										className="w-8 h-8 rounded-xl bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border border-brand-border flex items-center justify-center transition-all shadow-xs cursor-pointer"
										disabled={isLoading}
										isLoading={isRestarting}
										spinner={
											<RotateCw size={13} className="animate-spin text-brand-primary" />
										}
										icon={<RotateCw size={13} />}
										onClick={() => onRestart(service.name)}
										title="Restart"
									/>

									<Button
										className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition-all shadow-xs cursor-pointer"
										disabled={isLoading}
										isLoading={isStopping}
										spinner={
											<RotateCw size={13} className="animate-spin text-rose-600" />
										}
										icon={<Square size={13} fill="currentColor" />}
										onClick={() => onStop(service.name)}
										title="Stop Service"
									/>

									<Button
										className="w-8 h-8 rounded-xl bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border border-brand-border flex items-center justify-center transition-all shadow-xs cursor-pointer"
										icon={<BarChart2 size={13} />}
										onClick={() => onInspect(service)}
										title="Detailed Metrics"
									/>
								</div>
							</motion.div>
						);
					})}
				</div>
			</div>
		</div>
	);
};
