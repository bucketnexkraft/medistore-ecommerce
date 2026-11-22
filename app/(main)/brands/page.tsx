import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Layers3, Package, Search } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import { fetchBrandsSectionServer } from "@/lib/brands-server";

type BrandsPageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BrandsPage({ searchParams }: BrandsPageProps) {
	const resolvedSearchParams = (await searchParams) || {};
	const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q.trim() : "";
	const data = await fetchBrandsSectionServer(60);
	const brands = query
		? data.brands.filter((brand) => brand.name.toLowerCase().includes(query.toLowerCase()))
		: data.brands;
	const featuredBrand = brands[0] || null;

	return (
		<main className="pb-16 md:pb-24">
			<section className="section pt-8">
				<div className="flex items-center gap-2 text-sm text-primary-body">
					<Link href="/" className="transition-colors hover:text-primary-black">
						Home
					</Link>
					<ChevronRight className="h-4 w-4" />
					<span className="font-semibold text-primary-black">Brands</span>
				</div>
			</section>

			<section className="section pt-6">
				<div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:p-8">
					<div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:items-end">
						<div>
							<h1 className="text-3xl font-bold text-primary-black md:text-4xl">All Brands</h1>
							<p className="mt-4 max-w-2xl text-base leading-7 text-primary-body md:text-lg">
								Explore available brands and jump straight into filtered products.
							</p>

							<form method="get" className="mt-6 max-w-xl">
								<label className="flex items-center gap-3 rounded-full border border-gray-200 bg-[#f8fafc] px-5 py-4">
									<Search className="h-5 w-5 text-primary-body" />
									<input
										type="search"
										name="q"
										defaultValue={query}
										placeholder="Search brands like Nike, Canon, Logitech..."
										className="w-full bg-transparent text-sm text-primary-black outline-none placeholder:text-primary-body/70"
									/>
								</label>
							</form>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<StatCard label="Visible brands" value={data.stats.brands_count} icon={<Layers3 className="h-5 w-5" />} />
							<StatCard label="Linked products" value={data.stats.products_count} icon={<Package className="h-5 w-5" />} />
						</div>
					</div>
				</div>
			</section>

			{featuredBrand ? (
				<section className="section pt-8">
					<div className="grid gap-6 rounded-[28px] border border-gray-200 bg-white p-6 md:p-8 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-center">
						<div className="relative mx-auto aspect-square w-full max-w-[180px] overflow-hidden rounded-[24px] border border-gray-100 bg-[#f8fafc]">
							<SafeImage src={featuredBrand.image} alt={featuredBrand.name} fill sizes="220px" className="object-contain p-8" />
						</div>
						<div>
							<p className="text-sm font-semibold text-primary-body">Featured brand</p>
							<h2 className="mt-3 text-3xl font-bold text-primary-black">{featuredBrand.name}</h2>
							<p className="mt-3 text-base leading-7 text-primary-body">
								{featuredBrand.products_count.toLocaleString()} products currently available.
							</p>
						</div>
						<div>
							<Link
								href={featuredBrand.url}
								className="inline-flex items-center rounded-full bg-primary-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-theme-coral"
							>
								Browse Products
							</Link>
						</div>
					</div>
				</section>
			) : null}

			<section className="section pt-8">
				<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-2xl font-bold text-primary-black md:text-3xl">
							{query ? `Results for "${query}"` : "Every brand in one place"}
						</h2>
						<p className="mt-2 text-primary-body">{brands.length.toLocaleString()} brands ready to explore.</p>
					</div>
				</div>

				{brands.length ? (
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
						{brands.map((brand) => (
							<Link
								key={brand.id}
								href={brand.url}
								className="group flex items-center gap-5 rounded-[24px] border border-gray-200 bg-white p-5 transition hover:-translate-y-1 hover:border-gray-300 hover:shadow-[0_18px_35px_rgba(15,23,42,0.08)]"
							>
								<div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[20px] border border-gray-100 bg-[#f8fafc]">
									<SafeImage src={brand.image} alt={brand.name} fill sizes="96px" className="object-contain p-4" />
								</div>
								<div className="min-w-0 flex-1">
									<h3 className="text-xl font-bold text-primary-black transition group-hover:text-theme-coral">{brand.name}</h3>
									<p className="mt-2 text-sm text-primary-body">{brand.products_count.toLocaleString()} products in catalog</p>
									<span className="mt-4 inline-flex items-center text-sm font-semibold text-primary-black">View products</span>
								</div>
							</Link>
						))}
					</div>
				) : (
					<div className="rounded-[28px] border border-dashed border-secondary-stroke bg-white p-10 text-center">
						<h3 className="text-xl font-bold text-primary-black">No brands matched your search.</h3>
						<p className="mt-3 text-primary-body">Try a shorter keyword or clear the search to see the full storefront brand list.</p>
					</div>
				)}
			</section>
		</main>
	);
}

function StatCard({
	label,
	value,
	icon,
}: {
	label: string;
	value: number;
	icon: ReactNode;
}) {
	return (
		<div className="rounded-[22px] border border-gray-200 bg-[#f8fafc] p-5">
			<div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary-black">
				{icon}
			</div>
			<p className="text-3xl font-bold text-primary-black">{value.toLocaleString()}</p>
			<p className="mt-1 text-sm text-primary-body">{label}</p>
		</div>
	);
}
