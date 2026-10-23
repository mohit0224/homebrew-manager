import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Uncaught error:", error, errorInfo);
	}

	public render() {
		if (this.state.hasError) {
			return (
				<div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-brand-bg text-brand-text select-none">
					<div className="bg-white rounded-3xl border border-brand-border p-8 shadow-xl max-w-md w-full flex flex-col items-center">
						<div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
							<AlertTriangle size={32} />
						</div>
						<h2 className="text-lg font-bold text-brand-text mb-2">
							Something went wrong
						</h2>
						<p className="text-xs text-brand-muted mb-6 max-w-xs leading-relaxed">
							{this.state.error?.message ||
								"An unexpected error occurred in the view."}
						</p>
						<Button
							className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs"
							icon={<RefreshCw size={14} />}
							onClick={() => {
								this.setState({ hasError: false });
								window.location.reload();
							}}
						>
							Reload Application
						</Button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
