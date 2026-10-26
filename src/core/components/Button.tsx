import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Visual style variant preset */
	variant?:
		| "primary"
		| "secondary"
		| "danger"
		| "outline"
		| "ghost"
		| "custom";
	/** Size preset */
	size?: "xs" | "sm" | "md" | "lg" | "icon" | "custom";
	/** Controls automated loading state and spinner display */
	isLoading?: boolean;
	/** Optional replacement text while loading */
	loadingText?: React.ReactNode;
	/** Icon displayed when not loading */
	icon?: React.ReactNode;
	/** Custom spinner element (defaults to Loader2) */
	spinner?: React.ReactNode;
	/** Enable macOS shrink-and-pop click animation (default true) */
	animateClick?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			children,
			className = "",
			variant = "custom",
			size = "custom",
			isLoading = false,
			loadingText,
			icon,
			spinner,
			animateClick = true,
			disabled,
			type = "button",
			...props
		},
		ref,
	) => {
		const isDisabled = disabled || isLoading;

		const variantStyles: Record<string, string> = {
			primary:
				"bg-brand-primary hover:bg-brand-primary-hover text-white shadow-xs font-semibold",
			secondary:
				"bg-white hover:bg-slate-50 text-brand-text border border-brand-border shadow-xs font-medium",
			outline:
				"bg-transparent hover:bg-brand-bg text-brand-text border border-brand-border font-medium",
			danger:
				"bg-rose-500 hover:bg-rose-600 text-white shadow-xs font-semibold",
			ghost:
				"bg-transparent hover:bg-slate-100 text-brand-muted hover:text-brand-text font-medium",
			custom: "",
		};

		const sizeStyles: Record<string, string> = {
			xs: "px-2.5 py-1 text-xs rounded-lg gap-1.5",
			sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
			md: "px-4 py-2 text-sm rounded-xl gap-2",
			lg: "px-6 py-3 text-base rounded-2xl gap-2.5",
			icon: "p-2 rounded-xl shrink-0 flex items-center justify-center",
			custom: "",
		};

		const animationClass = animateClick && !isDisabled ? "hm-button" : "";
		const positionClass =
			className.includes("absolute") || className.includes("fixed")
				? ""
				: "relative";

		return (
			<button
				ref={ref}
				type={type}
				disabled={isDisabled}
				aria-busy={isLoading ? "true" : undefined}
				className={`${positionClass} inline-flex items-center justify-center select-none cursor-pointer transition-all ${
					variantStyles[variant] || ""
				} ${sizeStyles[size] || ""} ${animationClass} ${
					isLoading ? "cursor-wait opacity-90" : ""
				} ${disabled && !isLoading ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
				{...props}
			>
				{isLoading ? (
					<>
						{spinner || (
							<Loader2
								size={14}
								className="animate-spin shrink-0 text-current"
							/>
						)}
						{loadingText ? (
							<span>{loadingText}</span>
						) : (
							children && <span>{children}</span>
						)}
					</>
				) : (
					<>
						{icon && <span className="shrink-0">{icon}</span>}
						{children}
					</>
				)}
			</button>
		);
	},
);

Button.displayName = "Button";
