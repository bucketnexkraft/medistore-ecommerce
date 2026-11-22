"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import CategoryProductsGrid from "@/components/categories/CategoryProductsGrid";
import { apiFetch } from "@/lib/api-client";

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
	original_price?: number | null;
	discount_percent?: number;
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

type ProductsMeta = {
	current_page: number;
	last_page: number;
	per_page: number;
	total: number;
	has_more: boolean;
};

type SelectedFilters = {
	q: string;
	category: string;
	brand: string;
	demand_tag: string;
	stock: string;
	sort: string;
	min_price: number | null;
	max_price: number | null;
};

interface ProductsBrowsePanelProps {
	initialProducts: ProductItem[];
	initialMeta: ProductsMeta;
	categories: FilterOption[];
	brands: FilterOption[];
	demandTags: DemandTagOption[];
	initialSelected: SelectedFilters;
}

export default function ProductsBrowsePanel({
	initialProducts,
	initialMeta,
	categories = [],
	brands = [],
	demandTags = [],
	initialSelected,
}: ProductsBrowsePanelProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [isPending, startTransition] = useTransition();
	const [products, setProducts] = useState<ProductItem[]>(initialProducts);
	const [meta, setMeta] = useState<ProductsMeta>(initialMeta);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [form, setForm] = useState({
		q: initialSelected.q || "",
		category: initialSelected.category || "",
		brand: initialSelected.brand || "",
		demandTag: initialSelected.demand_tag || "",
		stock: initialSelected.stock || "all",
		sort: initialSelected.sort || "newest",
		minPrice: initialSelected.min_price?.toString() || "",
		maxPrice: initialSelected.max_price?.toString() || "",
	});

	useEffect(() => {
		setProducts(initialProducts);
		setMeta(initialMeta);
		setForm({
			q: initialSelected.q || "",
			category: initialSelected.category || "",
			brand: initialSelected.brand || "",
			demandTag: initialSelected.demand_tag || "",
			stock: initialSelected.stock || "all",
			sort: initialSelected.sort || "newest",
			minPrice: initialSelected.min_price?.toString() || "",
			maxPrice: initialSelected.max_price?.toString() || "",
		});
	}, [initialMeta, initialProducts, initialSelected]);

	const buildQueryString = (page = 1) => {
		const params = new URLSearchParams();

		if (form.q.trim()) params.set("q", form.q.trim());
		if (form.category) params.set("category", form.category);
		if (form.brand) params.set("brand", form.brand);
		if (form.demandTag) params.set("demand_tag", form.demandTag);
		if (form.stock && form.stock !== "all") params.set("stock", form.stock);
		if (form.sort && form.sort !== "newest") params.set("sort", form.sort);
		if (form.minPrice.trim()) params.set("minPrice", form.minPrice.trim());
		if (form.maxPrice.trim()) params.set("maxPrice", form.maxPrice.trim());
		params.set("page", String(page));
		params.set("perPage", String(meta.per_page || 12));

		return params.toString();
	};

	const fetchProducts = async (page = 1, replace = false) => {
		const query = buildQueryString(page);
		const response = await apiFetch(`/landing/products?${query}`, {
			cache: "no-store",
		});

		if (!response.ok) {
			throw new Error("Failed to load products");
		}

		const result = await response.json();
		const data = result?.data;
		const nextProducts = Array.isArray(data?.products) ? data.products : [];
		const nextMeta = data?.products_meta;

		setProducts((current) => (replace ? nextProducts : [...current, ...nextProducts]));
		setMeta({
			current_page: Number(nextMeta?.current_page || page),
			last_page: Number(nextMeta?.last_page || page),
			per_page: Number(nextMeta?.per_page || meta.per_page || 12),
			total: Number(nextMeta?.total || 0),
			has_more: Boolean(nextMeta?.has_more),
		});
	};

	const syncUrl = () => {
		const params = new URLSearchParams(buildQueryString(1));
		params.delete("page");
		params.delete("perPage");
		const query = params.toString();

		startTransition(() => {
			router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
		});
	};

	const handleApplyFilters = async () => {
		setIsLoading(true);

		try {
			await fetchProducts(1, true);
			syncUrl();
		} finally {
			setIsLoading(false);
		}
	};

	const handleResetFilters = async () => {
		setForm({
			q: "",
			category: "",
			brand: "",
			demandTag: "",
			stock: "all",
			sort: "newest",
			minPrice: "",
			maxPrice: "",
		});

		setIsLoading(true);

		try {
			const response = await apiFetch(`/landing/products?page=1&perPage=${meta.per_page || 12}`, {
				cache: "no-store",
			});

			if (!response.ok) {
				throw new Error("Failed to reset products");
			}

			const result = await response.json();
			const data = result?.data;
			setProducts(Array.isArray(data?.products) ? data.products : []);
			setMeta({
				current_page: Number(data?.products_meta?.current_page || 1),
				last_page: Number(data?.products_meta?.last_page || 1),
				per_page: Number(data?.products_meta?.per_page || meta.per_page || 12),
				total: Number(data?.products_meta?.total || 0),
				has_more: Boolean(data?.products_meta?.has_more),
			});

			startTransition(() => {
				router.replace(pathname, { scroll: false });
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleLoadMore = async () => {
		if (!meta.has_more || isLoadingMore) {
			return;
		}

		setIsLoadingMore(true);

		try {
			await fetchProducts(meta.current_page + 1, false);
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
						<button onClick={handleResetFilters} className="text-sm font-semibold text-primary-green transition-opacity hover:opacity-80">
							Reset
						</button>
					</div>

					<div className="space-y-5">
						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-900">Search</label>
							<div className="relative">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
								<input
									type="text"
									value={form.q}
									onChange={(event) => setForm((current) => ({ ...current, q: event.target.value }))}
									placeholder="Search by name..."
									className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-700 outline-none transition-colors focus:border-primary-green"
								/>
							</div>
						</div>

						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-900">Category</label>
							<select
								value={form.category}
								onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
								className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-colors focus:border-primary-green"
							>
								<option value="">All categories</option>
								{categories.map((category) => (
									<option key={category.id} value={category.slug}>
										{category.name}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-900">Brand</label>
							<select
								value={form.brand}
								onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
								className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-colors focus:border-primary-green"
							>
								<option value="">All brands</option>
								{brands.map((brand) => (
									<option key={brand.id} value={brand.slug}>
										{brand.name}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-900">Demand Tag</label>
							<select
								value={form.demandTag}
								onChange={(event) => setForm((current) => ({ ...current, demandTag: event.target.value }))}
								className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-colors focus:border-primary-green"
							>
								<option value="">All demand tags</option>
								{demandTags.map((tag) => (
									<option key={tag.value} value={tag.value}>
										{tag.label}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-900">Availability</label>
							<select
								value={form.stock}
								onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
								className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-colors focus:border-primary-green"
							>
								<option value="all">All products</option>
								<option value="in-stock">In stock</option>
								<option value="out-of-stock">Out of stock</option>
							</select>
						</div>

						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-900">Sort By</label>
							<select
								value={form.sort}
								onChange={(event) => setForm((current) => ({ ...current, sort: event.target.value }))}
								className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-colors focus:border-primary-green"
							>
								<option value="newest">Newest first</option>
								<option value="price-low-high">Price: low to high</option>
								<option value="price-high-low">Price: high to low</option>
								<option value="name-a-z">Name: A to Z</option>
								<option value="name-z-a">Name: Z to A</option>
							</select>
						</div>

						<div>
							<label className="mb-2 block text-sm font-semibold text-gray-900">Price Range</label>
							<div className="grid grid-cols-2 gap-3">
								<input
									type="number"
									min="0"
									value={form.minPrice}
									onChange={(event) => setForm((current) => ({ ...current, minPrice: event.target.value }))}
									placeholder="Min"
									className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-colors focus:border-primary-green"
								/>
								<input
									type="number"
									min="0"
									value={form.maxPrice}
									onChange={(event) => setForm((current) => ({ ...current, maxPrice: event.target.value }))}
									placeholder="Max"
									className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-colors focus:border-primary-green"
								/>
							</div>
						</div>

						<button
							onClick={handleApplyFilters}
							disabled={isLoading}
							className="w-full rounded-full bg-primary-black px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isLoading ? "Applying..." : "Apply Filters"}
						</button>
					</div>
				</div>
			</div>

			<div className="lg:col-span-3">
				<div className="mb-6 rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div>
							<h2 className="text-2xl font-bold text-primary-black">{meta.total.toLocaleString()} Products Found</h2>
							<p className="mt-1 text-sm text-primary-body">
								Showing {products.length.toLocaleString()} of {meta.total.toLocaleString()} products
							</p>
						</div>

						<div className="flex flex-wrap gap-3">
							<SummaryPill label="Categories" value={categories.length} />
							<SummaryPill label="Brands" value={brands.length} />
							<SummaryPill label="Demand Tags" value={demandTags.length} />
							<SummaryPill label="Status" value={isPending ? "Updating..." : "Live"} />
						</div>
					</div>
				</div>

				<CategoryProductsGrid products={products} />

				{meta.has_more ? (
					<div className="mt-8 flex justify-center">
						<button
							onClick={handleLoadMore}
							disabled={isLoadingMore}
							className="rounded-full border border-[#d7e4db] bg-white px-6 py-3 text-sm font-semibold text-primary-black transition-colors hover:border-primary-green hover:text-primary-green disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isLoadingMore ? "Loading..." : "Load More Products"}
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
}

function SummaryPill({
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
