"use client";

import Image from "next/image";
import { OnSaleProduct } from "@/data/on-sale";

interface OnSaleCardProps {
	product: OnSaleProduct;
}

export function OnSaleCard({ product }: OnSaleCardProps) {
	return (
		<div className="flex flex-col">
			{/* Main Image Container */}
			<div className="relative rounded-20 overflow-hidden mb-6">
				<div className="relative h-80 sm:h-96 md:h-96 lg:h-120 xl:h-140 w-full">
					<Image src={product.mainImage} alt={product.name} fill className="object-cover" priority={false} />
				</div>

				{/* Save Percentage Badge */}
				<div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">Save {product.savings}%</div>
			</div>

			{/* Bottom Content - with top padding to account for floating image */}
			<div className="pt-16 px-4 py-4 -mt-9.5 rounded-bl-20 rounded-br-20 border border-t-0 border-secondary-stroke relative">
				{/* Secondary Image - Floating */}
				<div className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-24 h-24 bg-white rounded-md p-2.5 shadow-lg">
					<div className="relative w-full h-full">
						<Image src={product.secondaryImage} alt={product.name} fill className="object-contain" priority={false} />
					</div>
				</div>

				{/* Product Name */}
				<h4 className="text-lg font-semibold text-gray-900 mb-4 line-clamp-2">{product.name}</h4>

				{/* Divider */}
				<div className="h-px bg-secondary-stroke mb-4"></div>

				{/* Price */}
				<h4 className="text-lg font-semibold text-gray-900">${product.price.toFixed(2)}</h4>
			</div>
		</div>
	);
}
