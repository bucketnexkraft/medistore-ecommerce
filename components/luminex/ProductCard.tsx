"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { LuminexProduct } from "@/data/luminex-data";

interface ProductCardProps {
	onClose: () => void;
	product: LuminexProduct;
	onAddToBag: (product: LuminexProduct) => void;
}

export function ProductCard({ product, onAddToBag, onClose }: ProductCardProps) {
	const [isFavorite, setIsFavorite] = useState(false);

	return (
		<div className="bg-white rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
			{/* Image Container */}
			<div className="relative w-full md:h-60 h-48 bg-gray-100 rounded-lg overflow-hidden group">
				<Image src={product.image} alt={product.title} fill className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" />

				{/* Discount Badge */}
				<div className="absolute top-3 left-3 bg-green-500 px-3 py-1 rounded-full text-xs font-semibold">-{product.discount}%</div>

				{/* Favorite Heart */}
				<button
					onClick={() => setIsFavorite(!isFavorite)}
					className="absolute top-3 right-3 bg-primary-black/30 cursor-pointer rounded-full p-2 transition-colors group/heart"
				>
					<Heart size={20} className={isFavorite ? "fill-red-500 text-red-500" : "text-white group-hover/heart:text-red-500"} />
				</button>
			</div>

			{/* Product Details */}
			<div className="p-4 space-y-3">
				{/* Title */}
				<h3 className="font-bold line-clamp-2">{product.title}</h3>

				{/* Price */}
				<div className="flex items-center gap-2">
					<span className="font-semibold">${product.price.toFixed(2)}</span>
					<span className="text-primary-body text-xs mt-1 line-through">${product.originalPrice.toFixed(2)}</span>
				</div>

				{/* Rating */}
				<div className="flex items-center gap-1">
					<div className="flex gap-0.5">
						{[...Array(5)].map((_, i) => (
							<span key={i} className={i < product.rating ? "text-yellow-400" : "text-gray-300"}>
								★
							</span>
						))}
					</div>
					<span className="text-sm">({product.reviewCount} reviews)</span>
				</div>

				{/* Features */}
				<div className="flex flex-wrap gap-2">
					{product.features.map((feature) => (
						<span key={feature} className="text-xs font-medium bg-zinc-200 text-primary-black px-2.5 py-1 rounded-full">
							{feature}
						</span>
					))}
				</div>

				{/* Description */}
				<p className="text-xs text-primary-blue! bg-purple-100 p-2 mb-0 rounded font-medium">{product.description}</p>

				{/* Buttons */}
				<div className="flex gap-2 pt-2">
					<Link
						onClick={onClose}
						href={product.link}
						className="flex-1 bg-black text-white py-2 rounded text-sm font-semibold hover:bg-gray-800 transition-colors text-center"
					>
						Buy now
					</Link>
					<button
						onClick={() => onAddToBag(product)}
						className="flex-1 border border-primary-body/50 text-gray-900 py-2 cursor-pointer rounded text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
					>
						{/* <ShoppingBag size={16} /> */}
						<Image src="/images/header/shopping-bag.svg" alt="shopping bag" width={20} height={20} />
						<span>Add to Bag</span>
					</button>
					<button className=" border border-primary-body/50 text-gray-900 p-2 cursor-pointer rounded text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
						{/* <ShoppingBag size={16} /> */}
						<Image src="/icons/luminex/message.svg" alt="message" width={20} height={20} />
					</button>
				</div>
			</div>
		</div>
	);
}
