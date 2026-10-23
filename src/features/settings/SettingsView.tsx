import React, { useState, useEffect } from "react";
import { MetricThresholdConfig, BrewSystemInfo } from "../../core/types/brew";
import { brewApi } from "../../core/api/brewApi";
import {
	Bell,
	Cpu,
	HardDrive,
	Clock,
	CheckCircle2,
	Terminal,
	Volume2,
} from "lucide-react";
import { Button } from "../../core/components/Button";

const THRESHOLDS_STORAGE_KEY = "homebrew_manager_thresholds";

interface SettingsViewProps {
	thresholds: MetricThresholdConfig;
	onSave: (config: MetricThresholdConfig) => void;
	brewInfo?: BrewSystemInfo;
	activeCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
	thresholds,
	onSave,
	brewInfo,
	activeCount,
}) => {
	const [config, setConfig] = useState<MetricThresholdConfig>(() => {
		try {
			if (typeof window !== "undefined" && window.localStorage) {
				const saved = localStorage.getItem(THRESHOLDS_STORAGE_KEY);
				if (saved) return JSON.parse(saved);
			}
		} catch (err) {
			console.error("Failed to read thresholds from localStorage:", err);
		}
		return { ...thresholds };
	});
	const [saveSuccess, setSaveSuccess] = useState(false);

	useEffect(() => {
		setConfig({ ...thresholds });
	}, [thresholds]);

	const handleToggleNotifications = (enabled: boolean) => {
		const updated = {
			...config,
			notificationsEnabled: enabled,
		};
		setConfig(updated);
		onSave(updated);
		try {
			if (typeof window !== "undefined" && window.localStorage) {
				localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(updated));
			}
		} catch (err) {
			console.error("Failed to save toggle state to localStorage:", err);
		}
	};

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault();
		if (!config.notificationsEnabled) return;
		onSave(config);
		try {
			if (typeof window !== "undefined" && window.localStorage) {
				localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(config));
			}
		} catch (err) {
			console.error("Failed to save thresholds to localStorage:", err);
		}
		setSaveSuccess(true);
		setTimeout(() => setSaveSuccess(false), 2500);
	};

	const handleTestNotification = async () => {
		try {
			await brewApi.notifyTest(
				"HomeBrew Manager Alert",
				"Test notification successfully triggered from Settings.",
			);
		} catch {
			// Ignore if osascript restricted
		}
	};

	const handleSimulateSpike = async () => {
		try {
			await brewApi.notify(
				"High CPU Spike Alert",
				'Service "mongodb-community" is using 88.5% CPU (Limit: 80%)',
			);
		} catch (err) {
			console.error("Spike simulation failed:", err);
		}
	};

	return (
		<div className="max-w-4xl mx-auto flex flex-col gap-6 w-full">
			{/* Settings Header */}
			<div>
				<h2 className="text-2xl font-bold text-brand-text tracking-tight">
					Application Settings
				</h2>
				<p className="text-sm text-brand-muted mt-1">
					Configure real-time monitoring thresholds, background alerts and
					Homebrew environment parameters.
				</p>
			</div>

			{saveSuccess && (
				<div className="bg-[#E8F8F0] border border-brand-success/30 text-brand-success px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-xs">
					<CheckCircle2 size={16} />
					<span>
						Settings saved successfully. Monitoring thresholds are now active.
					</span>
				</div>
			)}

			<form onSubmit={handleSave} className="flex flex-col gap-6">
				{/* Section 1: Resource Alerts & Thresholds */}
				<div className="bg-white rounded-3xl border border-brand-border p-6 shadow-xs flex flex-col gap-6">
					<div className="flex items-center justify-between pb-4 border-b border-brand-border">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-purple-50 text-brand-primary flex items-center justify-center">
								<Bell size={20} />
							</div>
							<div>
								<h3 className="text-base font-bold text-brand-text">
									Monitoring Alerts
								</h3>
								<p className="text-xs text-brand-muted">
									Trigger desktop notifications when background services exceed
									safe CPU or RAM limits.
								</p>
							</div>
						</div>

						{/* Notifications Toggle */}
						<label className="relative inline-flex items-center cursor-pointer">
							<input
								type="checkbox"
								className="sr-only peer"
								checked={config.notificationsEnabled}
								onChange={(e) => handleToggleNotifications(e.target.checked)}
							/>
							<div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
						</label>
					</div>

					{(() => {
						const cpuPercent = Math.min(
							Math.max(
								((config.cpuThresholdPercent - 20) / (100 - 20)) * 100,
								0,
							),
							100,
						);
						const ramPercent = Math.min(
							Math.max(((config.ramThresholdMb - 256) / (4096 - 256)) * 100, 0),
							100,
						);
						const cooldownPercent = Math.min(
							Math.max(((config.cooldownSeconds - 10) / (300 - 10)) * 100, 0),
							100,
						);

						return (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								{/* CPU Threshold */}
								<div className="flex flex-col gap-2.5 bg-[#F9FAFD] p-4 rounded-2xl border border-brand-border">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2 text-xs font-semibold text-brand-text">
											<Cpu size={15} className="text-brand-primary" />
											<span>CPU Alert Spike Limit</span>
										</div>
										<span className="text-xs font-bold text-brand-primary bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
											{config.cpuThresholdPercent}%
										</span>
									</div>
									<input
										type="range"
										min="20"
										max="100"
										step="5"
										disabled={!config.notificationsEnabled}
										value={config.cpuThresholdPercent}
										onChange={(e) =>
											setConfig((prev) => ({
												...prev,
												cpuThresholdPercent: Number(e.target.value),
											}))
										}
										style={{
											background: config.notificationsEnabled
												? `linear-gradient(to right, #6250F5 0%, #6250F5 ${cpuPercent}%, #E2E8F0 ${cpuPercent}%, #E2E8F0 100%)`
												: "#E2E8F0",
										}}
										className="macos-slider w-full disabled:opacity-40"
									/>
									<span className="text-[11px] text-brand-muted">
										Notify when any service CPU usage exceeds{" "}
										{config.cpuThresholdPercent}%.
									</span>
								</div>

								{/* RAM Threshold */}
								<div className="flex flex-col gap-2.5 bg-[#F9FAFD] p-4 rounded-2xl border border-brand-border">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2 text-xs font-semibold text-brand-text">
											<HardDrive size={15} className="text-brand-primary" />
											<span>Memory (RAM) Spike Limit</span>
										</div>
										<span className="text-xs font-bold text-brand-primary bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
											{config.ramThresholdMb} MB
										</span>
									</div>
									<input
										type="range"
										min="256"
										max="4096"
										step="128"
										disabled={!config.notificationsEnabled}
										value={config.ramThresholdMb}
										onChange={(e) =>
											setConfig((prev) => ({
												...prev,
												ramThresholdMb: Number(e.target.value),
											}))
										}
										style={{
											background: config.notificationsEnabled
												? `linear-gradient(to right, #6250F5 0%, #6250F5 ${ramPercent}%, #E2E8F0 ${ramPercent}%, #E2E8F0 100%)`
												: "#E2E8F0",
										}}
										className="macos-slider w-full disabled:opacity-40"
									/>
									<span className="text-[11px] text-brand-muted">
										Notify when memory consumption exceeds{" "}
										{config.ramThresholdMb} MB.
									</span>
								</div>

								{/* Alert Cooldown */}
								<div className="flex flex-col gap-2.5 bg-[#F9FAFD] p-4 rounded-2xl border border-brand-border md:col-span-2">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2 text-xs font-semibold text-brand-text">
											<Clock size={15} className="text-brand-primary" />
											<span>Notification Cooldown Period</span>
										</div>
										<span className="text-xs font-bold text-brand-primary bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
											{config.cooldownSeconds} seconds
										</span>
									</div>
									<input
										type="range"
										min="10"
										max="300"
										step="10"
										disabled={!config.notificationsEnabled}
										value={config.cooldownSeconds}
										onChange={(e) =>
											setConfig((prev) => ({
												...prev,
												cooldownSeconds: Number(e.target.value),
											}))
										}
										style={{
											background: config.notificationsEnabled
												? `linear-gradient(to right, #6250F5 0%, #6250F5 ${cooldownPercent}%, #E2E8F0 ${cooldownPercent}%, #E2E8F0 100%)`
												: "#E2E8F0",
										}}
										className="macos-slider w-full disabled:opacity-40"
									/>
									<span className="text-[11px] text-brand-muted">
										Minimum delay before repeating an alert for the same active
										daemon.
									</span>
								</div>
							</div>
						);
					})()}

					<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
						<div className="flex items-center gap-2">
							{import.meta.env.DEV ? (
								<Button
									type="button"
									onClick={handleTestNotification}
									disabled={!config.notificationsEnabled}
									className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-brand-text rounded-xl text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
									icon={<Volume2 size={14} />}
								>
									Send Test Notification
								</Button>
							) : (
								<Button
									type="button"
									onClick={handleSimulateSpike}
									disabled={!config.notificationsEnabled}
									className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-50"
									icon={<Volume2 size={14} />}
								>
									Send Test Notification
								</Button>
							)}
						</div>

						<Button
							type="submit"
							disabled={!config.notificationsEnabled}
							className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-primary"
						>
							Save Monitoring Settings
						</Button>
					</div>
				</div>

				{/* Section 2: Homebrew System Environment Info */}
				<div className="bg-white rounded-3xl border border-brand-border p-6 shadow-xs flex flex-col gap-4">
					<div className="flex items-center gap-3 pb-3 border-b border-brand-border">
						<div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
							<Terminal size={20} />
						</div>
						<div>
							<h3 className="text-base font-bold text-brand-text">
								macOS Homebrew Environment
							</h3>
							<p className="text-xs text-brand-muted">
								Live runtime details detected from your local macOS
								installation.
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="bg-[#F9FAFD] border border-brand-border p-4 rounded-2xl flex flex-col gap-1">
							<span className="text-[11px] text-brand-muted font-medium">
								Core Version
							</span>
							<span className="text-sm font-bold text-brand-text font-mono">
								{brewInfo?.version || "Homebrew"}
							</span>
						</div>

						<div className="bg-[#F9FAFD] border border-brand-border p-4 rounded-2xl flex flex-col gap-1">
							<span className="text-[11px] text-brand-muted font-medium">
								Brew Prefix
							</span>
							<span className="text-sm font-bold text-brand-text font-mono truncate">
								{brewInfo?.prefix || "/opt/homebrew"}
							</span>
						</div>

						<div className="bg-[#F9FAFD] border border-brand-border p-4 rounded-2xl flex flex-col gap-1">
							<span className="text-[11px] text-brand-muted font-medium">
								Background Daemons
							</span>
							<span className="text-sm font-bold text-brand-success">
								{activeCount} running
							</span>
						</div>
					</div>
				</div>

				{/* Minimalist Application Status Bar */}
				<div className="flex items-center justify-between px-5 py-3.5 bg-white rounded-2xl border border-brand-border text-xs shadow-2xs">
					<div className="flex items-center gap-3">
						<img
							src="/favicon-128x128.png"
							alt="HomeBrew Manager"
							className="w-7 h-7 object-contain rounded-lg shrink-0"
						/>
						<span className="font-semibold text-brand-text">
							HomeBrew Manager
						</span>
						<span className="text-[11px] font-mono text-brand-muted bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
							v0.1.0
						</span>
					</div>

					<div className="flex items-center gap-1.5 text-xs font-medium text-brand-success bg-[#E8F8F0] px-2.5 py-1 rounded-full border border-brand-success/20">
						<span className="w-1.5 h-1.5 rounded-full bg-brand-success" />
						<span>Active</span>
					</div>
				</div>
			</form>
		</div>
	);
};
