export default function CategoryDetailsLoading() {
	return (
		<main className="pb-16 md:pb-24">
			<section className="section pt-8">
				<div className="h-5 w-56 animate-pulse rounded bg-gray-200" />
			</section>

			<section className="section pt-6">
				<div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
					<div className="rounded-[24px] border border-gray-200 bg-white p-6 md:p-8">
						<div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
						<div className="mt-4 h-10 w-56 animate-pulse rounded bg-gray-200" />
						<div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded bg-gray-200" />
						<div className="mt-2 h-5 w-3/4 max-w-lg animate-pulse rounded bg-gray-200" />
						<div className="mt-6 flex gap-3">
							{Array.from({ length: 3 }).map((_, index) => (
								<div key={index} className="h-10 w-28 animate-pulse rounded-full bg-gray-200" />
							))}
						</div>
					</div>

					<div className="min-h-[240px] rounded-[24px] bg-gray-200 animate-pulse" />
				</div>
			</section>

			<section className="section pt-8">
				<div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
				<div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="rounded-[20px] border border-gray-200 bg-white p-4">
							<div className="aspect-[4/3] animate-pulse rounded-2xl bg-gray-200" />
							<div className="mt-4 h-6 w-28 animate-pulse rounded bg-gray-200" />
							<div className="mt-2 h-4 w-20 animate-pulse rounded bg-gray-200" />
						</div>
					))}
				</div>
			</section>

			<section className="section pt-10">
				<div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
				<div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
					{Array.from({ length: 8 }).map((_, index) => (
						<div key={index} className="overflow-hidden rounded-[22px] border border-gray-200 bg-white">
							<div className="aspect-square animate-pulse bg-gray-200" />
							<div className="p-4">
								<div className="h-6 w-20 animate-pulse rounded bg-gray-200" />
								<div className="mt-3 h-5 w-full animate-pulse rounded bg-gray-200" />
								<div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-gray-200" />
								<div className="mt-4 h-8 w-24 animate-pulse rounded bg-gray-200" />
							</div>
						</div>
					))}
				</div>
			</section>
		</main>
	);
}
