"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function Toaster() {
	const { toasts, dismiss } = useToast();

	return (
		<div className="pointer-events-none fixed right-4 top-4 z-[160] flex w-full max-w-sm flex-col gap-3">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={cn(
						"pointer-events-auto rounded-2xl border p-4 shadow-[0_18px_50px_rgba(15,23,42,0.16)] transition-all",
						toast.variant === "success" && "border-emerald-200 bg-emerald-50",
						toast.variant === "error" && "border-rose-200 bg-rose-50",
						toast.variant === "info" && "border-sky-200 bg-sky-50",
						(!toast.variant || toast.variant === "default") && "border-violet-200 bg-violet-50",
						toast.open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
					)}
					role="status"
					aria-live="polite"
				>
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							{toast.title ? <p className="text-sm font-semibold text-primary-black">{toast.title}</p> : null}
							{toast.description ? <p className="mt-1 text-sm leading-6 text-primary-body">{toast.description}</p> : null}
							{toast.action ? <div className="mt-3">{toast.action}</div> : null}
						</div>
						<button
							type="button"
							onClick={() => dismiss(toast.id)}
							className="cursor-pointer text-xs font-semibold text-primary-body transition-colors hover:text-primary-black"
						>
							Close
						</button>
					</div>
				</div>
			))}
		</div>
	);
}
