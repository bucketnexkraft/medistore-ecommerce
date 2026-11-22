"use client";

import { ArrowRight } from "lucide-react";
import { luminexProducts, LuminexProduct } from "@/data/luminex-data";
import { ProductCard } from "./ProductCard";

interface RecommendedProductsProps {
	onClose: () => void;
	onAddToBag: (product: LuminexProduct) => void;
}

export function RecommendedProducts({ onClose, onAddToBag }: RecommendedProductsProps) {
	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="border-b border-primary-body/50 p-4 lg:p-6 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
						<ArrowRight size={26} />
					</button>
					<h2 className="text-lg font-semibold">Recommended for You</h2>
				</div>
				<span className="bg-purple-100 px-3 py-1 rounded-full text-purple-600 font-bold text-xs">{luminexProducts.length} Items</span>
			</div>

			{/* Products Grid */}
			<div className="flex-1 no-scrollbar overflow-y-auto p-4 lg:p-6 pb-20!">
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
					{luminexProducts.map((product) => (
						<ProductCard key={product.id} product={product} onAddToBag={onAddToBag} onClose={onClose} />
					))}
				</div>
			</div>
		</div>
	);
}
