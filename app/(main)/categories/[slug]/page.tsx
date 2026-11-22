import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { serverApiFetch } from "@/lib/api-client";
import CategoryBrowsePanel from "@/components/categories/CategoryBrowsePanel";

type Subcategory = {
	id: string;
	name: string;
	slug: string;
	image: string;
	products_count: number;
};

type CategoryProduct = {
	id: string;
	name: string;
	slug: string;
	thumbnail: string;
	price: number;
	original_price?: number | null;
	discount_percent?: number;
	quantity: number;
	brand: string;
	category: {
		name: string;
		slug: string;
	} | null;
	url: string;
};

type CategoryDetailsResponse = {
	category: {
		id: string;
		name: string;
		slug: string;
		image: string;
		products_count: number;
		parent: {
			name: string;
			slug: string;
		} | null;
	};
	subcategories: Subcategory[];
	products: CategoryProduct[];
	productsMeta: {
		current_page: number;
		last_page: number;
		per_page: number;
		total: number;
		has_more: boolean;
	};
};

interface CategoryDetailsPageProps {
	params: Promise<{
		slug: string;
	}>;
}

export default async function CategoryDetailsPage({ params }: CategoryDetailsPageProps) {
	const { slug } = await params;
	const data = await getCategoryDetails(slug);

	if (!data) {
		notFound();
	}

	return (
		<main className="pb-16 md:pb-24">
			<section className="section pt-8">
				<div className="flex flex-wrap items-center gap-2 text-sm text-primary-body">
					<Link href="/" className="hover:text-primary-black transition-colors">
						Home
					</Link>
					<ChevronRight className="h-4 w-4" />
					<Link href="/categories" className="hover:text-primary-black transition-colors">
						Categories
					</Link>
					<ChevronRight className="h-4 w-4" />
					<span className="font-semibold text-primary-black">{data.category.name}</span>
				</div>
			</section>

			<section className="section pt-6">
				<div className="rounded-[24px] border border-gray-200 bg-white p-6 md:p-8">
					<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div>
							<p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-green">Category</p>
							<h1 className="mt-2 text-3xl font-bold text-primary-black md:text-4xl">{data.category.name}</h1>
						</div>

						<div className="flex flex-wrap gap-3">
							<InfoPill label="Products" value={data.productsMeta.total} />
							<InfoPill label="Subcategories" value={data.subcategories.length} />
							{data.category.parent ? <InfoPill label="Parent" value={data.category.parent.name} /> : null}
						</div>
					</div>
				</div>
			</section>

			<section className="section pt-10">
				<CategoryBrowsePanel slug={data.category.slug} subcategories={data.subcategories} initialProducts={data.products} initialMeta={data.productsMeta} />
			</section>
		</main>
	);
}

async function getCategoryDetails(slug: string): Promise<CategoryDetailsResponse | null> {
	try {
		const headerStore = await headers();
		const host = headerStore.get("host");
		const response = await serverApiFetch(`/landing/categories/${encodeURIComponent(slug)}`, host, {
			next: { revalidate: 60 },
		});

		if (!response.ok) {
			return null;
		}

		const result = await response.json();
		const data = result?.data;

		if (!data?.category?.slug) {
			return null;
		}

		return {
			category: data.category,
			subcategories: Array.isArray(data?.subcategories) ? data.subcategories : [],
			products: Array.isArray(data?.products) ? data.products : [],
			productsMeta: {
				current_page: Number(data?.products_meta?.current_page || 1),
				last_page: Number(data?.products_meta?.last_page || 1),
				per_page: Number(data?.products_meta?.per_page || 12),
				total: Number(data?.products_meta?.total || 0),
				has_more: Boolean(data?.products_meta?.has_more),
			},
		};
	} catch {
		return null;
	}
}

function InfoPill({
	label,
	value,
}: {
	label: string;
	value: string | number;
}) {
	return (
		<div className="rounded-full bg-[#f5f7fa] px-4 py-2">
			<span className="text-sm font-medium text-primary-body">{label}: </span>
			<span className="text-sm font-bold text-primary-black">{value}</span>
		</div>
	);
}
