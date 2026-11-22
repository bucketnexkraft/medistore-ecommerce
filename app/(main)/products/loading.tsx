export default function ProductsLoading() {
	return (
		<main className="pb-16 md:pb-24">
			<section className="section pt-14">
				<div className="animate-pulse rounded-[28px] border border-gray-200 bg-white p-8">
					<div className="h-6 w-36 rounded-full bg-gray-200" />
					<div className="mt-4 h-10 w-72 rounded bg-gray-200" />
					<div className="mt-3 h-5 w-full max-w-2xl rounded bg-gray-100" />
				</div>
			</section>

			<section className="section pt-10">
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-8">
					<div className="rounded-[24px] border border-gray-200 bg-white p-6">
						<div className="h-6 w-32 rounded bg-gray-200" />
						<div className="mt-6 space-y-4">
							<div className="h-12 rounded-xl bg-gray-100" />
							<div className="h-12 rounded-xl bg-gray-100" />
							<div className="h-12 rounded-xl bg-gray-100" />
							<div className="h-12 rounded-xl bg-gray-100" />
							<div className="h-12 rounded-xl bg-gray-100" />
						</div>
					</div>

					<div className="lg:col-span-3">
						<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
							{Array.from({ length: 6 }).map((_, index) => (
								<div key={index} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
									<div className="h-64 bg-gray-200" />
									<div className="h-10 bg-gray-100" />
									<div className="space-y-3 p-4">
										<div className="h-6 rounded bg-gray-200" />
										<div className="h-4 w-3/4 rounded bg-gray-100" />
										<div className="h-5 w-1/2 rounded bg-gray-200" />
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}
