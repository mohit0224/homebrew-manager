import { useState } from "react";
import {
	Routes,
	Route,
	Navigate,
	useLocation,
	useNavigate,
} from "react-router-dom";
import { useBrew } from "./core/hooks/useBrew";
import { Sidebar } from "./core/components/Sidebar";
import { Header } from "./core/components/Header";
import { HomeDashboard } from "./features/dashboard/HomeDashboard";
import { InstalledPackagesView } from "./features/services-list/InstalledPackagesView";
import { MetricsModal } from "./features/active-monitor/MetricsModal";
import { SearchView } from "./features/package-search/SearchView";
import { GlobalSearchModal } from "./features/package-search/GlobalSearchModal";
import { UpgradesView } from "./features/software-upgrades/UpgradesView";
import { LogTerminal } from "./features/system-logs/LogTerminal";
import { ThresholdSettingsModal } from "./features/system-logs/ThresholdSettingsModal";
import { SettingsView } from "./features/settings/SettingsView";
import { isServiceRunning } from "./core/types/brew";
import { AnimatePresence, motion } from "framer-motion";

export function App() {
	const location = useLocation();
	const navigate = useNavigate();

	const {
		services,
		systemMetrics,
		brewInfo,
		selectedService,
		setSelectedService,
		searchResults,
		isSearching,
		searchError,
		handleSearch,
		handleInstall,
		outdated,
		isOutdatedLoading,
		refreshOutdated,
		handleUpgrade,
		handleStart,
		handleStop,
		handleRestart,
		runningActions,
		isRefreshingServices,
		logs,
		addLog,
		thresholds,
		setThresholds,
		refreshServices,
		stats,
	} = useBrew();

	const [filterText, setFilterText] = useState("");
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
	const [globalSearchQuery, setGlobalSearchQuery] = useState("");

	const handleOpenGlobalSearch = (query?: string) => {
		setGlobalSearchQuery(query !== undefined ? query : filterText);
		setIsGlobalSearchOpen(true);
	};

	const handleCloseGlobalSearch = () => {
		setIsGlobalSearchOpen(false);
		setGlobalSearchQuery("");
		setFilterText("");
	};

	const displayInstalledCount =
		services.length > 0 ? services.length : (stats?.installedPackages ?? 0);
	const displayActiveCount =
		services.length > 0
			? services.filter((s) => isServiceRunning(s.status)).length
			: (stats?.activeOperations ?? 0);
	const displayOutdatedCount =
		outdated.length > 0 ? outdated.length : (stats?.availableUpdates ?? 0);

	const liveSelectedService = selectedService
		? services.find((s) => s.name === selectedService.name) || selectedService
		: null;

	return (
		<div className="flex h-screen w-screen bg-brand-bg font-sans text-brand-text select-none overflow-hidden antialiased">
			{/* 1. Left Navigation Sidebar with React Router */}
			<Sidebar
				installedCount={displayInstalledCount}
				activeCount={displayActiveCount}
				outdatedCount={displayOutdatedCount}
				brewInfo={brewInfo}
				onOpenSettings={() => setIsSettingsOpen(true)}
			/>

			{/* 2. Main Content Area */}
			<div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
				<div className="flex-1 flex flex-col overflow-y-auto px-8 py-6">
					{/* Top Bar with Title, Subtitle & ⌘K Search */}
					<Header
						filterText={filterText}
						onFilterChange={setFilterText}
						onRefresh={() => refreshServices(true)}
						isRefreshing={isRefreshingServices}
						onOpenSettings={() => setIsSettingsOpen(true)}
						onOpenSearch={handleOpenGlobalSearch}
					/>

					{/* Main Routed Page Views */}
					<main className="flex-1 pb-8">
						<AnimatePresence mode="wait">
							<Routes location={location} key={location.pathname}>
								<Route
									path="/"
									element={
										<motion.div
											key="home"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -8 }}
											transition={{ duration: 0.15 }}
										>
											<HomeDashboard
												services={services}
												outdated={outdated}
												runningActions={runningActions}
												memoryUsedMb={systemMetrics.memoryUsedMb}
												metrics={systemMetrics}
												brewInfo={brewInfo}
												stats={stats}
												onNavigateTab={(tab) => navigate(`/${tab}`)}
												onInspectService={setSelectedService}
												onUpgradePackage={handleUpgrade}
												onRefreshOutdated={() => refreshOutdated(true)}
											/>
										</motion.div>
									}
								/>

								<Route
									path="/installed"
									element={
										<motion.div
											key="installed"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -8 }}
											transition={{ duration: 0.15 }}
										>
											<InstalledPackagesView
												services={services}
												filterText={filterText}
												runningActions={runningActions}
												onStart={handleStart}
												onStop={handleStop}
												onRestart={handleRestart}
												onInspect={setSelectedService}
											/>
										</motion.div>
									}
								/>

								<Route
									path="/search"
									element={
										<motion.div
											key="search"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -8 }}
											transition={{ duration: 0.15 }}
										>
											<SearchView
												onSearch={handleSearch}
												onInstall={handleInstall}
												results={searchResults}
												isSearching={isSearching}
												searchError={searchError}
												runningActions={runningActions}
											/>
										</motion.div>
									}
								/>

								<Route
									path="/outdated"
									element={
										<motion.div
											key="outdated"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -8 }}
											transition={{ duration: 0.15 }}
										>
											<UpgradesView
												outdated={outdated}
												isLoading={isOutdatedLoading}
												runningActions={runningActions}
												onRefresh={() => refreshOutdated(true)}
												onUpgrade={handleUpgrade}
											/>
										</motion.div>
									}
								/>

								<Route
									path="/logs"
									element={
										<motion.div
											key="logs"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -8 }}
											transition={{ duration: 0.15 }}
										>
											<LogTerminal logs={logs} />
										</motion.div>
									}
								/>

								<Route
									path="/settings"
									element={
										<motion.div
											key="settings"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -8 }}
											transition={{ duration: 0.15 }}
										>
											<SettingsView
												thresholds={thresholds}
												onSave={setThresholds}
												brewInfo={brewInfo}
												activeCount={displayActiveCount}
											/>
										</motion.div>
									}
								/>

								<Route path="*" element={<Navigate to="/" replace />} />
							</Routes>
						</AnimatePresence>
					</main>
				</div>
			</div>

			{/* 3. Service Metrics Details Modal */}
			{liveSelectedService && (
				<MetricsModal
					service={liveSelectedService}
					isLoading={!!runningActions[liveSelectedService.name]}
					actionType={
						typeof runningActions[liveSelectedService.name] === "string"
							? (runningActions[liveSelectedService.name] as string)
							: undefined
					}
					onClose={() => setSelectedService(null)}
					onStart={handleStart}
					onStop={handleStop}
					onRestart={handleRestart}
				/>
			)}

			{/* 4. Notification & Alert Rules Modal */}
			{isSettingsOpen && (
				<ThresholdSettingsModal
					thresholds={thresholds}
					onSave={setThresholds}
					onClose={() => setIsSettingsOpen(false)}
				/>
			)}

			{/* 5. Active Global Search Modal */}
			<GlobalSearchModal
				isOpen={isGlobalSearchOpen}
				initialQuery={globalSearchQuery}
				onClose={handleCloseGlobalSearch}
				onInstall={handleInstall}
				runningActions={runningActions}
				onLog={addLog}
			/>
		</div>
	);
}

export default App;
