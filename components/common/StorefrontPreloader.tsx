export default function StorefrontPreloader() {
	return (
		<main
			className="flex min-h-screen items-center justify-center bg-[#f3f1f1] px-6"
			aria-busy="true"
			aria-live="polite"
		>
			<div className="flex flex-col items-center gap-4 text-center">
				<span
					className="size-12 animate-spin rounded-full border-4 border-[#e6dede] border-t-[#6b3e3e]"
					aria-hidden="true"
				/>
				<p className="text-sm font-medium text-[#6b3e3e]">Loading storefront...</p>
			</div>
		</main>
	);
}
