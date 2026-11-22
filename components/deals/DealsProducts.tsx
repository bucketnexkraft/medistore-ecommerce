"use client";

import { useState, useMemo } from "react";
import { dealsProducts } from "@/data/deals-data";
import { DealsFilters } from "./DealsFilters";
import { DealsProductCard } from "./DealsProductCard";
import ThousandsOfShops from "../common/ThousandsOfShops";

export function DealsProducts() {
	const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

	const filteredProducts = useMemo(() => {
		if (selectedFilters.length === 0) return dealsProducts;

		return dealsProducts.filter((product) => {
			return selectedFilters.some((filter) => {
				// Condition Type filters
				if (filter === "near-expiry" && product.conditionType === "near-expiry") return true;
				if (filter === "damaged-package" && product.conditionType === "damaged-package") return true;
				if (filter === "open-box" && product.conditionType === "open-box") return true;
				if (filter === "overstock" && product.conditionType === "overstock") return true;
				if (filter === "last-pieces" && product.conditionType === "last-pieces") return true;

				// Expiry Window filters
				if (filter === "expiry-7days" && product.daysLeft <= 7) return true;
				if (filter === "expiry-15days" && product.daysLeft <= 15) return true;
				if (filter === "expiry-30days" && product.daysLeft <= 30) return true;
				if (filter === "expiry-60days" && product.daysLeft > 30) return true;

				// Discount Range filters
				if (filter === "discount-10-25" && product.discount >= 10 && product.discount <= 25) return true;
				if (filter === "discount-25-50" && product.discount >= 25 && product.discount <= 50) return true;
				if (filter === "discount-50-70" && product.discount >= 50 && product.discount <= 70) return true;
				if (filter === "discount-70" && product.discount >= 70) return true;

				// Category filters
				if (filter === product.category) return true;

				return false;
			});
		});
	}, [selectedFilters]);

	return (
		<main className="min-h-screen py-16">
			<div className="section">
				{/* Main Layout */}
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
					{/* Left - Filters (lg:w-1/4) */}
					<div className="lg:col-span-1">
						<DealsFilters onFiltersChange={setSelectedFilters} />
					</div>

					{/* Right - Products (lg:w-3/4) */}
					<div className="lg:col-span-3">
						{/* Header */}
						<div className="mb-8">
							<h5 className="text-2xl font-bold">{filteredProducts.length} Products Found</h5>
						</div>

						{/* Products Grid */}
						{filteredProducts.length > 0 ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
								{filteredProducts.map((product) => (
									<DealsProductCard key={product.id} product={product} />
								))}
							</div>
						) : (
							<div className="text-center py-12">
								<p className="text-gray-500 text-lg">No products found matching your filters.</p>
							</div>
						)}
					</div>
				</div>

				{/* Thousand of shops */}
				<ThousandsOfShops />
			</div>
		</main>
	);
}
