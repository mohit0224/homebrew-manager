import React from "react";
import { CommandLogEntry } from "../../core/types/brew";
import { Terminal as TerminalIcon } from "lucide-react";

interface LogTerminalProps {
	logs: CommandLogEntry[];
	onClear?: () => void;
}

export const LogTerminal: React.FC<LogTerminalProps> = ({ logs }) => {
	return (
		<div className="flex flex-col gap-4">
			{/* Top Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<div className="w-8 h-8 rounded-lg bg-brand-primary-light text-brand-primary flex items-center justify-center">
						<TerminalIcon size={16} />
					</div>
					<h3 className="text-lg font-bold text-brand-text">
						Command Execution Log
					</h3>
				</div>
				<span className="text-xs font-semibold bg-brand-primary-light text-brand-primary px-2.5 py-0.5 rounded-full">
					{logs.length} entries
				</span>
			</div>

			{/* Terminal Window */}
			<div className="bg-[#0F172A] rounded-3xl border border-slate-800/80 p-5 font-mono text-xs text-slate-300 shadow-xl min-h-125 max-h-165 overflow-y-auto flex flex-col">
				{/* Terminal Title Bar */}
				<div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-800 text-[11px] text-slate-500">
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 rounded-full bg-rose-500/80" />
						<div className="w-3 h-3 rounded-full bg-amber-500/80" />
						<div className="w-3 h-3 rounded-full bg-emerald-500/80" />
					</div>
					<span>zsh - brew command output</span>
					<div className="w-10" />
				</div>

				{logs.length === 0 ? (
					<div className="text-slate-500 text-center py-24">
						No commands executed yet. Action outputs and background alerts will
						stream here.
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{logs.map((log) => {
							const colorClass =
								log.type === "error"
									? "text-rose-400 font-semibold"
									: log.type === "success"
										? "text-emerald-400 font-semibold"
										: log.type === "info"
											? "text-purple-400"
											: log.type === "stderr"
												? "text-amber-400"
												: "text-slate-300";

							return (
								<div
									key={log.id}
									className="flex items-start gap-2.5 leading-relaxed"
								>
									<span className="text-slate-500 shrink-0 select-none">
										[{log.timestamp}]
									</span>
									<span className={`break-all ${colorClass}`}>{log.text}</span>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
};
