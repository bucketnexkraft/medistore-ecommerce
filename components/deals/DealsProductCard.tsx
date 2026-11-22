"use client";

import Image from "next/image";
import { Clock, Package, Check } from "lucide-react";
import { DealsProduct } from "@/data/deals-data";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DealsProductCardProps {
	product: DealsProduct;
}

export function DealsProductCard({ product }: DealsProductCardProps) {
	const [isAddedToBag, setIsAddedToBag] = useState(false);
	const handleAddToBag = () => {
		setIsAddedToBag(true);
	};

	return (
		<div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
			{/* Image Container */}
			<div className="relative h-68 bg-gray-100 overflow-hidden">
				<Image src={product.image} alt={product.title} fill className="object-cover" priority={false} />

				{/* New Expiry Badge - Left */}
				<div className="absolute top-3 left-3 bg-theme-yellow px-3 py-1 border border-yellow-600 rounded-full text-xs font-medium capitalize">
					{product.conditionType.replace(/-/g, " ")}
				</div>

				{/* Discount Badge - Right */}
				<div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">-{product.discount}%</div>
			</div>

			{/* Content */}
			<div className="p-4">
				{/* Product Title */}
				<h3 className="text-lg font-medium text-[#101828] mb-4 line-clamp-2">{product.title}</h3>

				{/* Best Before Date */}
				<div className="flex items-center gap-2 mb-2 text-sm text-primary-body">
					<Package size={16} />
					<span>Best before: {product.bestBefore}</span>
				</div>

				{/* Days Left */}
				<div className="flex items-center gap-2 mb-4 text-sm text-[#ff9500] font-semibold">
					<Clock size={16} />
					<span>{product.daysLeft} days left</span>
				</div>

				{/* Price */}
				<div className="flex items-baseline gap-2 mb-3">
					<span className="text-2xl font-bold">${product.price.toFixed(2)}</span>
					<span className="text-sm text-gray-500 line-through">${product.originalPrice.toFixed(2)}</span>
				</div>

				{/* Stock Left */}
				<div className="flex items-start gap-2 mb-3">
					<Image src="/images/deals/stock.svg" alt="stock down" width={16} height={16} className="mt-0.5" />
					<p className="text-sm text-primary-body ">Only {product.stockLeft} left</p>
				</div>

				{/* Store Name */}
				<p className="text-sm text-gray-600">
					by <span className="font-semibold text-primary-black!">{product.storeName}</span>
				</p>

				<hr className="my-4" />

				{/* Add to Bag Button */}
				<button
					onClick={handleAddToBag}
					className={cn(
						"w-full py-2 rounded-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer border",
						isAddedToBag ? "bg-white  border-gray-200" : "bg-[#ffcc00] border-[#ffcc00] hover:bg-yellow-500",
					)}
				>
					{isAddedToBag ? (
						<>
							<Check size={18} />
							<span>Added to Bag</span>
						</>
					) : (
						<>
							<Image src="/images/header/shopping-bag.svg" alt="shopping bag" width={18} height={18} />
							<span>Add to Bag</span>
						</>
					)}
				</button>
			</div>
		</div>
	);
}
