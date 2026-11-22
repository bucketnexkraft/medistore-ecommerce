import { headers } from "next/headers";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { serverApiFetch } from "@/lib/api-client";
import { resolveApiAssetUrl } from "@/lib/config";
import SafeImage from "@/components/common/SafeImage";

type CategoryChild = {
	id: string;
	name: string;
	slug: string;
	image: string;
	products_count: number;
};

type CategoryItem = {
	id: string;
	name: string;
	slug: string;
	image: string;
	products_count: number;
	children_count: number;
	children: CategoryChild[];
};

type CategoriesResponse = {
	heading: string;
	subheading: string;
	categories: CategoryItem[];
	stats: {
		categories_count: number;
		subcategories_count: number;
		products_count: number;
	};
};

const fallbackData: CategoriesResponse = {
	heading: "All Categories",
	subheading: "Browse all departments and jump straight into the products you want.",
	categories: [],
	stats: {
		categories_count: 0,
		subcategories_count: 0,
		products_count: 0,
	},
};

export default async function CategoriesPage() {
	const data = await getCategoriesPageData();

	return (
		<main className="pb-16 md:pb-24">
			<section className="section pt-8">
				<div className="flex items-center gap-2 text-sm text-primary-body">
					<Link href="/" className="hover:text-primary-black transition-colors">
						Home
					</Link>
					<ChevronRight className="h-4 w-4" />
					<span className="font-semibold text-primary-black">Categories</span>
				</div>
			</section>

			<section className="section pt-8">
				{data.categories.length > 0 ? (
					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
						{data.categories.map((category) => (
							<Link
								key={category.id}
								href={`/categories/${category.slug}`}
								prefetch
								className="group rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#d3e8d9] hover:shadow-lg"
							>
								<div className="flex items-start gap-4">
									<div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#f6f8fa]">
										<SafeImage
											unoptimized
											src={category.image || "/images/placeholder.jpg"}
											alt={category.name}
											fill
											sizes="96px"
											className="object-cover transition-transform duration-300 group-hover:scale-105"
										/>
									</div>

									<div className="min-w-0 flex-1">
										<h2 className="text-lg font-bold text-primary-black transition-colors group-hover:text-primary-green">{category.name}</h2>
										<p className="mt-1 text-sm text-primary-body">
											{category.products_count} products
											{category.children_count > 0 ? ` • ${category.children_count} subcategories` : ""}
										</p>

										<div className="mt-3 flex flex-wrap gap-2">
											{category.children.slice(0, 4).map((child) => (
												<span key={child.id} className="rounded-full bg-[#f5f7fa] px-2.5 py-1 text-xs font-medium text-primary-body">
													{child.name}
												</span>
											))}
											{category.children.length > 4 ? (
												<span className="rounded-full bg-[#212124] px-2.5 py-1 text-xs font-medium text-white">+{category.children.length - 4}</span>
											) : null}
										</div>
									</div>
								</div>
							</Link>
						))}
					</div>
				) : (
					<div className="rounded-[24px] border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
						<h2 className="text-2xl font-bold text-primary-black">No categories available</h2>
						<p className="mt-3 text-primary-body">Categories will appear here as soon as they are published.</p>
					</div>
				)}
			</section>
		</main>
	);
}

async function getCategoriesPageData(): Promise<CategoriesResponse> {
	try {
		const headerStore = await headers();
		const host = headerStore.get("host");
		const response = await serverApiFetch("/landing/categories", host, {
			next: { revalidate: 120 },
		});

		if (!response.ok) {
			return fallbackData;
		}

		const result = await response.json();
		const data = result?.data;

		return {
			heading: String(data?.heading || fallbackData.heading),
			subheading: String(data?.subheading || fallbackData.subheading),
			categories: Array.isArray(data?.categories)
				? data.categories.map((category: CategoryItem) => ({
						...category,
						image: resolveApiAssetUrl(category.image, host),
						children: Array.isArray(category.children)
							? category.children.map((child) => ({
									...child,
									image: resolveApiAssetUrl(child.image, host),
								}))
							: [],
					}))
				: [],
			stats: {
				categories_count: Number(data?.stats?.categories_count || 0),
				subcategories_count: Number(data?.stats?.subcategories_count || 0),
				products_count: Number(data?.stats?.products_count || 0),
			},
		};
	} catch {
		return fallbackData;
	}
}
