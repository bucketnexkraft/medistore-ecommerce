export default function CategoriesLoading() {
	return (
		<main className="pb-16 md:pb-24">
			<section className="section pt-8">
				<div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
			</section>

			<section className="section pt-6">
				<div className="rounded-[28px] border border-gray-200 bg-white p-6 md:p-10">
					<div className="h-10 w-48 animate-pulse rounded bg-gray-200" />
					<div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded bg-gray-200" />
					<div className="mt-2 h-5 w-3/4 max-w-xl animate-pulse rounded bg-gray-200" />
					<div className="mt-8 grid gap-4 sm:grid-cols-3">
						{Array.from({ length: 3 }).map((_, index) => (
							<div key={index} className="rounded-[22px] border border-gray-100 bg-gray-50 p-4">
								<div className="h-10 w-10 animate-pulse rounded-2xl bg-gray-200" />
								<div className="mt-4 h-4 w-24 animate-pulse rounded bg-gray-200" />
								<div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="section pt-10">
				<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 6 }).map((_, index) => (
						<div key={index} className="overflow-hidden rounded-[24px] border border-gray-200 bg-white">
							<div className="aspect-[16/10] animate-pulse bg-gray-200" />
							<div className="p-6">
								<div className="h-7 w-40 animate-pulse rounded bg-gray-200" />
								<div className="mt-3 h-4 w-32 animate-pulse rounded bg-gray-200" />
								<div className="mt-5 flex flex-wrap gap-2">
									{Array.from({ length: 4 }).map((__, chipIndex) => (
										<div key={chipIndex} className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />
									))}
								</div>
							</div>
						</div>
					))}
				</div>
			</section>
		</main>
	);
}
