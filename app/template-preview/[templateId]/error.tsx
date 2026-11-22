"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function TemplatePreviewError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Template preview route failed:", error);
	}, [error]);

	return (
		<main className="min-h-screen bg-background">
			<div className="section py-16">
				<div className="rounded-3xl border border-secondary-stroke bg-white p-10 shadow-sm">
					<p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-500">Preview error</p>
					<h1 className="mt-3 text-3xl font-bold text-primary-black">Template preview could not load</h1>
					<p className="mt-4 max-w-2xl text-primary-body">
						This template hit a server-side rendering issue. You can retry the preview or go back to the theme list.
					</p>

					<div className="mt-8 flex flex-wrap gap-3">
						<button
							type="button"
							onClick={reset}
							className="rounded-full bg-primary-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
						>
							Try again
						</button>
						<Link
							href="/themes"
							className="rounded-full border border-secondary-stroke px-5 py-3 text-sm font-semibold text-primary-black transition hover:bg-slate-50"
						>
							Back to themes
						</Link>
					</div>

					{process.env.NODE_ENV !== "production" ? (
						<pre className="mt-8 overflow-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
							{error.message}
						</pre>
					) : null}
				</div>
			</div>
		</main>
	);
}
