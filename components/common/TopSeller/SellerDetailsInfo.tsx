"use client";

import Image from "next/image";
import { Check, Star, CheckCircle, Award, Clock4, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopSeller } from "@/data/topSellers";

interface SellerDetailsInfoProps {
	seller: TopSeller;
}

export function SellerDetailsInfo({ seller }: SellerDetailsInfoProps) {
	return (
		<div className="lg:w-1/4 lg:flex lg:flex-col xl:pl-10">
			{/* Card Container - overlaps cover image */}
			<div className="bg-white rounded-20 border border-secondary-stroke/50 p-6 -mt-28  relative z-10 mx-4 lg:mx-0">
				{/* Logo */}
				<div className="mb-4 text-center">
					<div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
						<Image src={seller.logo} alt={seller.name} width={80} height={80} className="object-contain" />
					</div>
				</div>

				{/* Seller Name */}
				<h1 className="text-2xl font-bold text-gray-900 text-center mb-2">{seller.name}</h1>

				{/* Location */}
				<p className="text-sm text-gray-600 text-center mb-4">📍 {seller.location}</p>

				{/* Description */}
				<p className="text-sm text-gray-700 text-center mb-6">{seller.description}</p>

				{/* Badges */}
				<div className="flex md:flex-row flex-col gap-4 mb-6">
					{seller.isVerified && (
						<div className="flex items-center gap-2 text-blue-500 text-sm font-semibold">
							<Award size={20} />
							<span>Verified Seller</span>
						</div>
					)}
					{seller.isTopSeller && (
						<div className="flex items-center gap-2 text-sm font-semibold">
							<Star size={18} fill="#ffcc00" className="text-[#ffcc00]" />
							<span className="text-blue-500">Top Seller</span>
						</div>
					)}
				</div>

				{/* Action Buttons */}
				<div className="flex lg:flex-row flex-col gap-3 mb-6">
					<Button className=" bg-red-500 hover:bg-red-600 text-white font-semibold" size="lg">
						Follow Store
					</Button>
					<Button variant="outline" className="font-semibold" size="lg">
						Contact Seller
					</Button>
				</div>
			</div>

			{/* Stats */}
			<div className="space-y-3 bg-white rounded-20 border border-secondary-stroke/50 p-6 mt-3">
				<div className="flex items-center gap-2 text-gray-700">
					<div className="bg-zinc-200 w-8 h-8 rounded-full flex items-center justify-center">
						<Clock4 size={18} className="text-bg" />
					</div>
					<span className="text-sm font-medium text-primary-black">{seller.responseTime}</span>
				</div>
				<div className="flex items-center gap-2 text-gray-700">
					<div className="bg-zinc-200 w-8 h-8 rounded-full flex items-center justify-center">
						<Box size={18} className="text-bg" />
					</div>
					<span className="text-sm font-medium text-primary-black">{seller.fulfillmentRate}</span>
				</div>
				<div className="flex items-center gap-2 text-gray-700">
					<div className="bg-zinc-200 w-8 h-8 rounded-full flex items-center justify-center">
						<Star size={18} className="text-bg" />
					</div>
					<span className="text-sm font-medium text-primary-black">4.8 ({seller.totalReviews.toLocaleString()} reviews)</span>
				</div>
			</div>
		</div>
	);
}
