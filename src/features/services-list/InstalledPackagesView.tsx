import React from "react";
import { BrewService } from "../../core/types/brew";
import { ServiceCard } from "./ServiceCard";

interface InstalledPackagesViewProps {
	services: BrewService[];
	filterText: string;
	runningActions: Record<string, any>;
	onStart: (name: string) => void;
	onStop: (name: string) => void;
	onRestart: (name: string) => void;
	onInspect: (service: BrewService) => void;
}

export const InstalledPackagesView: React.FC<InstalledPackagesViewProps> = ({
	services,
	filterText,
	runningActions,
	onStart,
	onStop,
	onRestart,
	onInspect,
}) => {
	const filteredServices = services.filter((s) =>
		s.name.toLowerCase().includes(filterText.toLowerCase()),
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between text-xs text-brand-muted px-1">
				<span>
					Showing <strong>{filteredServices.length}</strong> of{" "}
					<strong>{services.length}</strong> installed packages
				</span>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filteredServices.map((service) => (
					<ServiceCard
						key={service.name}
						service={service}
						isLoading={!!runningActions[service.name]}
						actionType={
							typeof runningActions[service.name] === "string"
								? (runningActions[service.name] as string)
								: undefined
						}
						onStart={onStart}
						onStop={onStop}
						onRestart={onRestart}
						onInspect={onInspect}
					/>
				))}
				{filteredServices.length === 0 && (
					<div className="col-span-full bg-white rounded-3xl border border-brand-border py-20 px-6 text-center text-sm text-brand-muted shadow-xs">
						No matching services or packages found for "{filterText}".
					</div>
				)}
			</div>
		</div>
	);
};
