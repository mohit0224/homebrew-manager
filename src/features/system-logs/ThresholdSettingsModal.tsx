import React, { useState } from "react";
import { MetricThresholdConfig } from "../../core/types/brew";
import { brewApi } from "../../core/api/brewApi";
import { X, Bell, ShieldCheck, Zap } from "lucide-react";
import { Button } from "../../core/components/Button";

interface ThresholdSettingsModalProps {
	thresholds: MetricThresholdConfig;
	onSave: (config: MetricThresholdConfig) => void;
	onClose: () => void;
}

export const ThresholdSettingsModal: React.FC<ThresholdSettingsModalProps> = ({
	thresholds,
	onSave,
	onClose,
}) => {
	const [cpu, setCpu] = useState(thresholds.cpuThresholdPercent);
	const [ram, setRam] = useState(thresholds.ramThresholdMb);
	const [enabled, setEnabled] = useState(thresholds.notificationsEnabled);
	const [cooldown, setCooldown] = useState(thresholds.cooldownSeconds);
	const [testSent, setTestSent] = useState(false);

	React.useEffect(() => {
		setCpu(thresholds.cpuThresholdPercent);
		setRam(thresholds.ramThresholdMb);
		setEnabled(thresholds.notificationsEnabled);
		setCooldown(thresholds.cooldownSeconds);
	}, [thresholds]);

	const handleSave = () => {
		onSave({
			cpuThresholdPercent: cpu,
			ramThresholdMb: ram,
			notificationsEnabled: enabled,
			cooldownSeconds: cooldown,
		});
		onClose();
	};

	const handleTest = async () => {
		await brewApi.notifyTest(
			"HomeBrew Manager Test",
			"macOS Notification Center integration is working properly.",
		);
		setTestSent(true);
		setTimeout(() => setTestSent(false), 3000);
	};

	return (
		<div
			className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none"
			onClick={onClose}
		>
			<div
				className="bg-white rounded-3xl border border-brand-border p-6 shadow-2xl max-w-lg w-full flex flex-col gap-5"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-brand-border">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 rounded-xl bg-brand-primary-light text-brand-primary flex items-center justify-center">
							<Bell size={16} />
						</div>
						<h3 className="text-base font-bold text-brand-text">
							Notification & Alert Rules
						</h3>
					</div>
					<Button
						className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-brand-text flex items-center justify-center transition-colors cursor-pointer"
						onClick={onClose}
						icon={<X size={15} />}
					/>
				</div>

				<p className="text-xs text-brand-muted">
					Configure native macOS notifications when background services exceed
					CPU or Memory limits.
				</p>

				<div className="flex flex-col gap-4">
					{/* Notifications Toggle */}
					<div className="flex items-center justify-between bg-[#F8F9FD] border border-brand-border p-3.5 rounded-2xl">
						<div className="flex flex-col">
							<span className="text-sm font-semibold text-brand-text">
								Enable Spike Notifications
							</span>
							<span className="text-xs text-brand-muted">
								Post native macOS notifications on resource spikes
							</span>
						</div>
						<input
							type="checkbox"
							className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
							checked={enabled}
							onChange={(e) => {
								const val = e.target.checked;
								setEnabled(val);
								onSave({
									cpuThresholdPercent: cpu,
									ramThresholdMb: ram,
									notificationsEnabled: val,
									cooldownSeconds: cooldown,
								});
							}}
						/>
					</div>

					{(() => {
						const cpuPercent = Math.min(
							Math.max(((cpu - 20) / (95 - 20)) * 100, 0),
							100,
						);
						const ramPercent = Math.min(
							Math.max(((ram - 256) / (4096 - 256)) * 100, 0),
							100,
						);
						const cooldownPercent = Math.min(
							Math.max(((cooldown - 15) / (300 - 15)) * 100, 0),
							100,
						);

						return (
							<>
								{/* CPU Threshold */}
								<div className="flex flex-col gap-1.5">
									<div className="flex justify-between items-center text-xs">
										<label className="font-semibold text-brand-text">
											CPU Spike Limit
										</label>
										<span className="font-bold text-brand-primary">{cpu}%</span>
									</div>
									<input
										type="range"
										min="20"
										max="95"
										step="5"
										disabled={!enabled}
										className="macos-slider w-full disabled:opacity-40"
										style={{
											background: enabled
												? `linear-gradient(to right, #6250F5 0%, #6250F5 ${cpuPercent}%, #E2E8F0 ${cpuPercent}%, #E2E8F0 100%)`
												: "#E2E8F0",
										}}
										value={cpu}
										onChange={(e) => setCpu(Number(e.target.value))}
									/>
									<span className="text-[11px] text-brand-muted">
										Alerts when any service consumes more than {cpu}% CPU.
									</span>
								</div>

								{/* RAM Threshold */}
								<div className="flex flex-col gap-1.5">
									<div className="flex justify-between items-center text-xs">
										<label className="font-semibold text-brand-text">
											Memory Spike Limit (MB)
										</label>
										<span className="font-bold text-brand-primary">
											{ram} MB
										</span>
									</div>
									<input
										type="range"
										min="256"
										max="4096"
										step="128"
										disabled={!enabled}
										className="macos-slider w-full disabled:opacity-40"
										style={{
											background: enabled
												? `linear-gradient(to right, #6250F5 0%, #6250F5 ${ramPercent}%, #E2E8F0 ${ramPercent}%, #E2E8F0 100%)`
												: "#E2E8F0",
										}}
										value={ram}
										onChange={(e) => setRam(Number(e.target.value))}
									/>
									<span className="text-[11px] text-brand-muted">
										Alerts when any service consumes more than {ram} MB RAM.
									</span>
								</div>

								{/* Cooldown */}
								<div className="flex flex-col gap-1.5">
									<div className="flex justify-between items-center text-xs">
										<label className="font-semibold text-brand-text">
											Alert Cooldown
										</label>
										<span className="font-bold text-brand-primary">
											{cooldown}s
										</span>
									</div>
									<input
										type="range"
										min="15"
										max="300"
										step="15"
										disabled={!enabled}
										className="macos-slider w-full disabled:opacity-40"
										style={{
											background: enabled
												? `linear-gradient(to right, #6250F5 0%, #6250F5 ${cooldownPercent}%, #E2E8F0 ${cooldownPercent}%, #E2E8F0 100%)`
												: "#E2E8F0",
										}}
										value={cooldown}
										onChange={(e) => setCooldown(Number(e.target.value))}
									/>
									<span className="text-[11px] text-brand-muted">
										Minimum seconds to wait before sending another alert for the
										same service.
									</span>
								</div>
							</>
						);
					})()}
				</div>

				{/* Buttons */}
				<div className="flex items-center justify-between gap-3 pt-3 border-t border-brand-border">
					<Button
						disabled={!enabled}
						className="bg-white hover:bg-[#F8F9FD] text-brand-muted hover:text-brand-text border border-brand-border font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-40"
						onClick={handleTest}
						icon={<Zap size={14} className="text-amber-500" />}
					>
						<span>{testSent ? "Notification Sent!" : "Test Notification"}</span>
					</Button>

					<Button
						disabled={!enabled}
						className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-primary"
						onClick={handleSave}
						icon={<ShieldCheck size={14} />}
					>
						<span>Save Settings</span>
					</Button>
				</div>
			</div>
		</div>
	);
};
