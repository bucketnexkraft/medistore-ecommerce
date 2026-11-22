"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { topSellers } from "@/data/topSellers";

export function TopSellerCards() {
	return (
		<section className="pt-8">
			<div>
				{/* Cards Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
					{topSellers.map((seller) => (
						<Link key={seller.id} href={`/topseller/${seller.slug}`}>
							<div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer h-full flex flex-col p-2">
								{/* Logo/Image Area */}
								<div className="bg-fg h-40 flex items-center justify-center rounded-lg">
									<Image src={seller.logo} alt={seller.name} width={120} height={120} className="object-contain" />
								</div>

								{/* Content Area */}
								<div className="p-4 flex flex-col items-center">
									{/* Seller Name */}
									<h3 className="text-xl font-extrabold  mb-3">{seller.name}</h3>

									{/* Rating */}
									<div className="flex items-center gap-1 mb-4">
										<span className="text-yellow-400">⭐⭐⭐⭐⭐</span>
										<span className="text-sm text-gray-600">({seller.reviews} reviews)</span>
									</div>

									{/* View Store Button */}
									<div className="mt-auto">
										<button className="text-theme-coral font-semibold flex items-center justify-center gap-2 cursor-pointer">
											<span>View Store</span>
											<div className="bg-theme-coral w-6 h-6 rounded-full flex items-center justify-center">
												<ArrowRight size={16} className="text-white -rotate-45" />
											</div>
										</button>
									</div>
								</div>
							</div>
						</Link>
					))}
				</div>
			</div>
		</section>
	);
}
