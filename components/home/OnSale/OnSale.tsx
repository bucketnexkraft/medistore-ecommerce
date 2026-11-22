"use client";

import { onSaleProducts } from "@/data/on-sale";
import { OnSaleCard } from "./OnSaleCard";

export function OnSale() {
	return (
		<section className="py-12 px-4">
			<div className="section">
				{/* Section Title */}
				<h2 className="text-3xl font-bold text-gray-900 mb-8">On sale</h2>

				{/* Cards Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{onSaleProducts.map((product) => (
						<OnSaleCard key={product.id} product={product} />
					))}
				</div>
			</div>
		</section>
	);
}
