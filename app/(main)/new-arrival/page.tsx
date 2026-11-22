import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Clock3, Package, Shapes, Tags } from "lucide-react";
import ProductsBrowsePanel from "@/components/products/ProductsBrowsePanel";
import { serverApiFetch } from "@/lib/api-client";

type FilterOption = {
	id: string;
	name: string;
	slug: string;
};

type DemandTagOption = {
	value: string;
	label: string;
};

type ProductItem = {
	id: string;
	name: string;
	slug: string;
	thumbnail: string;
	price: number;
	quantity: number;
	brand: string;
	brand_slug: string;
	rating?: number | null;
	reviews?: number;
	category: {
		name: string;
		slug: string;
	} | null;
	url: string;
};

type ProductsPageData = {
	heading: string;
	subheading: string;
	products: ProductItem[];
	productsMeta: {
		current_page: number;
		last_page: number;
		per_page: number;
		total: number;
		has_more: boolean;
	};
	filters: {
		categories: FilterOption[];
		brands: FilterOption[];
		demand_tags: DemandTagOption[];
		selected: {
			q: string;
			category: string;
			brand: string;
			demand_tag: string;
			stock: string;
			sort: string;
			min_price: number | null;
			max_price: number | null;
		};
	};
	stats: {
		products_count: number;
		categories_count: number;
		brands_count: number;
	};
};

const fallbackData: ProductsPageData = {
	heading: "New Arrivals",
	subheading: "Discover the latest products added to this storefront with fast filters and load more browsing.",
	products: [],
	productsMeta: {
		current_page: 1,
		last_page: 1,
		per_page: 12,
		total: 0,
		has_more: false,
	},
	filters: {
		categories: [],
		brands: [],
		demand_tags: [],
		selected: {
			q: "",
			category: "",
			brand: "",
			demand_tag: "",
			stock: "all",
			sort: "newest",
			min_price: null,
			max_price: null,
		},
	},
	stats: {
		products_count: 0,
		categories_count: 0,
		brands_count: 0,
	},
};

interface NewArrivalPageProps {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewArrivalPage({ searchParams }: NewArrivalPageProps) {
	const resolvedSearchParams = (await searchParams) || {};
	const data = await getNewArrivalPageData(resolvedSearchParams);

	return (
		<main className="pb-16 md:pb-24">
			<section className="section pt-8">
				<div className="flex items-center gap-2 text-sm text-primary-body">
					<Link href="/" className="transition-colors hover:text-primary-black">
						Home
					</Link>
					<ChevronRight className="h-4 w-4" />
					<span className="font-semibold text-primary-black">New Arrival</span>
				</div>
			</section>

			<section className="section pt-6">
				<div className="rounded-[28px] border border-gray-200 bg-white p-6 md:p-8">
					<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
						<div className="max-w-2xl">
							<div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff5ea] px-3 py-1.5 text-sm font-semibold text-primary-black">
								<Clock3 className="h-4 w-4 text-[#ea580c]" />
								Fresh Drops
							</div>
							<h1 className="text-3xl font-bold text-primary-black md:text-4xl">{data.heading}</h1>
							<p className="mt-3 text-base leading-7 text-primary-body">{data.subheading}</p>
						</div>

						<div className="grid grid-cols-3 gap-3 sm:gap-4">
							<MiniStat label="Products" value={data.stats.products_count} icon={<Package className="h-4 w-4" />} />
							<MiniStat label="Categories" value={data.stats.categories_count} icon={<Shapes className="h-4 w-4" />} />
							<MiniStat label="Brands" value={data.stats.brands_count} icon={<Tags className="h-4 w-4" />} />
						</div>
					</div>
				</div>
			</section>

			<section className="section pt-10">
				<ProductsBrowsePanel
					initialProducts={data.products}
					initialMeta={data.productsMeta}
					categories={data.filters.categories}
					brands={data.filters.brands}
					demandTags={data.filters.demand_tags}
					initialSelected={data.filters.selected}
				/>
			</section>
		</main>
	);
}

async function getNewArrivalPageData(searchParams: Record<string, string | string[] | undefined>): Promise<ProductsPageData> {
	try {
		const query = new URLSearchParams();
		query.set("sort", "newest");

		for (const [key, value] of Object.entries(searchParams)) {
			if (typeof value === "string" && value.trim() !== "") {
				query.set(key, value);
			}
		}

		if (!query.get("sort")) {
			query.set("sort", "newest");
		}

		const headerStore = await headers();
		const host = headerStore.get("host");
		const response = await serverApiFetch(`/landing/products?${query.toString()}`, host, {
			next: { revalidate: 60 },
		});

		if (!response.ok) {
			return fallbackData;
		}

		const result = await response.json();
		const data = result?.data;

		return {
			heading: "New Arrivals",
			subheading: "Discover the latest products added to this storefront with category, brand, stock, and price filters.",
			products: Array.isArray(data?.products) ? data.products : [],
			productsMeta: {
				current_page: Number(data?.products_meta?.current_page || 1),
				last_page: Number(data?.products_meta?.last_page || 1),
				per_page: Number(data?.products_meta?.per_page || 12),
				total: Number(data?.products_meta?.total || 0),
				has_more: Boolean(data?.products_meta?.has_more),
			},
			filters: {
				categories: Array.isArray(data?.filters?.categories) ? data.filters.categories : [],
				brands: Array.isArray(data?.filters?.brands) ? data.filters.brands : [],
				demand_tags: Array.isArray(data?.filters?.demand_tags) ? data.filters.demand_tags : [],
				selected: {
					q: String(data?.filters?.selected?.q || ""),
					category: String(data?.filters?.selected?.category || ""),
					brand: String(data?.filters?.selected?.brand || ""),
					demand_tag: String(data?.filters?.selected?.demand_tag || ""),
					stock: String(data?.filters?.selected?.stock || "all"),
					sort: "newest",
					min_price:
						typeof data?.filters?.selected?.min_price === "number" ? Number(data.filters.selected.min_price) : null,
					max_price:
						typeof data?.filters?.selected?.max_price === "number" ? Number(data.filters.selected.max_price) : null,
				},
			},
			stats: {
				products_count: Number(data?.stats?.products_count || 0),
				categories_count: Number(data?.stats?.categories_count || 0),
				brands_count: Number(data?.stats?.brands_count || 0),
			},
		};
	} catch {
		return fallbackData;
	}
}

function MiniStat({
	label,
	value,
	icon,
}: {
	label: string;
	value: number;
	icon: ReactNode;
}) {
	return (
		<div className="rounded-2xl bg-[#f8fafc] px-4 py-3 text-center">
			<div className="mx-auto mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#ea580c] shadow-sm">{icon}</div>
			<p className="text-lg font-bold text-primary-black">{value.toLocaleString()}</p>
			<p className="text-xs font-medium text-primary-body">{label}</p>
		</div>
	);
}
