import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
	onFinish?: () => void;
	minimumDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
	onFinish,
	minimumDurationMs = 1100,
}) => {
	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(false);
			onFinish?.();
		}, minimumDurationMs);
		return () => clearTimeout(timer);
	}, [minimumDurationMs, onFinish]);

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ opacity: 1 }}
					exit={{ opacity: 0, scale: 1.02 }}
					transition={{ duration: 0.35, ease: "easeInOut" }}
					className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-[#121427]/98 backdrop-blur-xl select-none"
				>
					<div className="flex flex-col items-center">
						{/* Animated Brand Icon with vibrant glow */}
						<motion.div
							initial={{ scale: 0.85, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ duration: 0.45, ease: "easeOut" }}
							className="relative w-28 h-28 mb-5 flex items-center justify-center"
						>
							<div className="absolute inset-0 bg-linear-to-tr from-[#FF176F]/25 to-[#FF5B97]/30 rounded-3xl blur-xl animate-pulse" />
							<img
								src="/android-chrome-512x512.png"
								alt="Homebrew Manager"
								className="w-28 h-28 object-contain rounded-2xl relative z-10 drop-shadow-md"
							/>
						</motion.div>

						{/* App Title & Subtitle */}
						<motion.div
							initial={{ y: 8, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							transition={{ delay: 0.15, duration: 0.35 }}
							className="text-center"
						>
							<h1 className="text-2xl font-bold text-brand-text tracking-tight">
								HomeBrew Manager
							</h1>
							<p className="text-xs text-brand-muted mt-1 font-medium">
								macOS Package Management
							</p>
						</motion.div>

						{/* Sleek Progress loader */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.25, duration: 0.35 }}
							className="mt-7 w-44"
						>
							<div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
								<motion.div
									initial={{ x: "-100%" }}
									animate={{ x: "100%" }}
									transition={{
										repeat: Infinity,
										duration: 1.1,
										ease: "easeInOut",
									}}
									className="h-full w-1/2 bg-linear-to-r from-[#FF176F] to-[#FF5B97] rounded-full"
								/>
							</div>
							<p className="text-[11px] text-center text-brand-muted mt-2.5 font-medium">
								Loading environment...
							</p>
						</motion.div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
