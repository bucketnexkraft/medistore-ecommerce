"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CategoryProductsGrid from "@/components/categories/CategoryProductsGrid";
import { apiFetch } from "@/lib/api-client";

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

type PriceRange = "under-50" | "50-100" | "100-250" | "250-plus";

interface CategoryBrowsePanelProps {
	slug: string;
	subcategories: Subcategory[];
	initialProducts: CategoryProduct[];
	initialMeta: {
		current_page: number;
		last_page: number;
		per_page: number;
		total: number;
		has_more: boolean;
	};
}

export default function CategoryBrowsePanel({
	slug,
	subcategories,
	initialProducts,
	initialMeta,
}: CategoryBrowsePanelProps) {
	const [products, setProducts] = useState<CategoryProduct[]>(initialProducts);
	const [productsMeta, setProductsMeta] = useState(initialMeta);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
	const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
	const [selectedPriceRanges, setSelectedPriceRanges] = useState<PriceRange[]>([]);
	const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "out-of-stock">("all");

	const brands = useMemo(() => {
		return Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b));
	}, [products]);

	const filteredProducts = useMemo(() => {
		return products.filter((product) => {
			const matchesSubcategory =
				selectedSubcategories.length === 0 ||
				(selectedSubcategories.includes("uncategorized") && !product.category?.slug) ||
				(selectedSubcategories.includes(product.category?.slug || ""));

			const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(product.brand);

			const matchesStock =
				stockFilter === "all" ||
				(stockFilter === "in-stock" && product.quantity > 0) ||
				(stockFilter === "out-of-stock" && product.quantity <= 0);

			const matchesPrice =
				selectedPriceRanges.length === 0 ||
				selectedPriceRanges.some((range) => {
					if (range === "under-50") return product.price < 50;
					if (range === "50-100") return product.price >= 50 && product.price < 100;
					if (range === "100-250") return product.price >= 100 && product.price < 250;
					return product.price >= 250;
				});

			return matchesSubcategory && matchesBrand && matchesStock && matchesPrice;
		});
	}, [products, selectedBrands, selectedPriceRanges, selectedSubcategories, stockFilter]);

	const toggleItem = (value: string, selected: string[], setSelected: (next: string[]) => void) => {
		setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
	};

	const togglePriceRange = (value: PriceRange) => {
		setSelectedPriceRanges(
			selectedPriceRanges.includes(value) ? selectedPriceRanges.filter((item) => item !== value) : [...selectedPriceRanges, value],
		);
	};

	const resetFilters = () => {
		setSelectedSubcategories([]);
		setSelectedBrands([]);
		setSelectedPriceRanges([]);
		setStockFilter("all");
	};

	const handleLoadMore = async () => {
		if (!productsMeta.has_more || isLoadingMore) {
			return;
		}

		setIsLoadingMore(true);

		try {
			const nextPage = productsMeta.current_page + 1;
			const response = await apiFetch(`/landing/categories/${encodeURIComponent(slug)}?page=${nextPage}&perPage=${productsMeta.per_page}`, {
				cache: "no-store",
			});

			if (!response.ok) {
				return;
			}

			const result = await response.json();
			const nextProducts = Array.isArray(result?.data?.products) ? result.data.products : [];
			const nextMeta = result?.data?.products_meta;

			setProducts((current) => [...current, ...nextProducts]);
			setProductsMeta({
				current_page: Number(nextMeta?.current_page || nextPage),
				last_page: Number(nextMeta?.last_page || productsMeta.last_page),
				per_page: Number(nextMeta?.per_page || productsMeta.per_page),
				total: Number(nextMeta?.total || productsMeta.total),
				has_more: Boolean(nextMeta?.has_more),
			});
		} finally {
			setIsLoadingMore(false);
		}
	};

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-8">
			<div className="lg:col-span-1">
				<div className="rounded-lg border bg-white p-6">
					<div className="mb-6 flex items-center justify-between gap-3">
						<h2 className="text-lg font-bold text-gray-900">Filters</h2>
						<button onClick={resetFilters} className="text-sm font-semibold text-primary-green cursor-pointer transition-opacity hover:opacity-80">
							Reset
						</button>
					</div>

					{subcategories.length > 0 ? (
						<div className="mb-8 border-b border-gray-200 pb-8">
							<h3 className="mb-4 text-sm font-semibold text-gray-900">Subcategory</h3>
							<div className="space-y-3">
								{subcategories.map((subcategory) => (
									<label key={subcategory.id} className="flex cursor-pointer items-center gap-3">
										<input
											type="checkbox"
											checked={selectedSubcategories.includes(subcategory.slug)}
											onChange={() => toggleItem(subcategory.slug, selectedSubcategories, setSelectedSubcategories)}
											className="h-4 w-4"
										/>
										<span className="text-sm text-gray-700">
											{subcategory.name} ({subcategory.products_count})
										</span>
									</label>
								))}
							</div>
						</div>
					) : null}

					{brands.length > 0 ? (
						<div className="mb-8 border-b border-gray-200 pb-8">
							<h3 className="mb-4 text-sm font-semibold text-gray-900">Brand</h3>
							<div className="space-y-3">
								{brands.map((brand) => (
									<label key={brand} className="flex cursor-pointer items-center gap-3">
										<input
											type="checkbox"
											checked={selectedBrands.includes(brand)}
											onChange={() => toggleItem(brand, selectedBrands, setSelectedBrands)}
											className="h-4 w-4"
										/>
										<span className="text-sm text-gray-700">{brand}</span>
									</label>
								))}
							</div>
						</div>
					) : null}

					<div className="mb-8 border-b border-gray-200 pb-8">
						<h3 className="mb-4 text-sm font-semibold text-gray-900">Availability</h3>
						<div className="space-y-3">
							<label className="flex cursor-pointer items-center gap-3">
								<input type="radio" name="stock-filter" checked={stockFilter === "all"} onChange={() => setStockFilter("all")} className="h-4 w-4" />
								<span className="text-sm text-gray-700">All products</span>
							</label>
							<label className="flex cursor-pointer items-center gap-3">
								<input type="radio" name="stock-filter" checked={stockFilter === "in-stock"} onChange={() => setStockFilter("in-stock")} className="h-4 w-4" />
								<span className="text-sm text-gray-700">In stock only</span>
							</label>
							<label className="flex cursor-pointer items-center gap-3">
								<input type="radio" name="stock-filter" checked={stockFilter === "out-of-stock"} onChange={() => setStockFilter("out-of-stock")} className="h-4 w-4" />
								<span className="text-sm text-gray-700">Out of stock</span>
							</label>
						</div>
					</div>

					<div>
						<h3 className="mb-4 text-sm font-semibold text-gray-900">Price Range</h3>
						<div className="space-y-3">
							{[
								{ id: "under-50", label: "Under 50" },
								{ id: "50-100", label: "50 - 100" },
								{ id: "100-250", label: "100 - 250" },
								{ id: "250-plus", label: "250+" },
							].map((range) => (
								<label key={range.id} className="flex cursor-pointer items-center gap-3">
									<input
										type="checkbox"
										checked={selectedPriceRanges.includes(range.id as PriceRange)}
										onChange={() => togglePriceRange(range.id as PriceRange)}
										className="h-4 w-4"
									/>
									<span className="text-sm text-gray-700">{range.label}</span>
								</label>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="lg:col-span-3">
				{subcategories.length > 0 ? (
					<div className="mb-8">
						<div className="mb-4 flex items-center justify-between gap-4">
							<h3 className="text-xl font-bold text-primary-black">Subcategories</h3>
							<p className="text-sm text-primary-body">Choose a narrower collection or use filters below.</p>
						</div>
						<div className="flex flex-wrap gap-3">
							{subcategories.map((subcategory) => (
								<Link
									key={subcategory.id}
									href={`/categories/${subcategory.slug}`}
									prefetch
									className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-primary-body transition-colors hover:border-primary-green hover:text-primary-green"
								>
									{subcategory.name}
								</Link>
							))}
						</div>
					</div>
				) : null}

				<div className="mb-8 flex items-center justify-between gap-4">
					<h2 className="text-2xl font-bold text-primary-black">{filteredProducts.length} Products Found</h2>
					<p className="text-sm text-primary-body">
						Showing {filteredProducts.length} of {productsMeta.total} products
					</p>
				</div>

				<CategoryProductsGrid products={filteredProducts} />

				{selectedSubcategories.length === 0 && selectedBrands.length === 0 && selectedPriceRanges.length === 0 && stockFilter === "all" && productsMeta.has_more ? (
					<div className="mt-8 flex justify-center">
						<button
							onClick={handleLoadMore}
							disabled={isLoadingMore}
							className="rounded-full bg-primary-black px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isLoadingMore ? "Loading..." : "Load More"}
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
}
