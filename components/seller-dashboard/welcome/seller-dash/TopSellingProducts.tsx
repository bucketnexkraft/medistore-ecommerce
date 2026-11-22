"use client";

import Image from "next/image";
import Link from "next/link";
import { topSellingProducts } from "@/data/seller-dashboard-data";

export function TopSellingProducts() {
	const displayedProducts = topSellingProducts.slice(0, 5);

	return (
		<div className="bg-white rounded-lg border border-gray-200">
			<div className="flex items-center justify-between border-b p-6">
				<h2 className="text-xl font-bold">Top Selling Products</h2>
				<Link href="#" className="text-primary-blue hover:text-purple-700 font-semibold text-sm">
					View all ↗
				</Link>
			</div>

			<div className="space-y-4 p-6">
				{displayedProducts.map((product) => (
					<div key={product.id} className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
						<div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 relative">
							<Image src={product.image} alt={product.name} width={32} height={32} className="w-8 h-8" />
						</div>
						<div className="flex-1 min-w-0">
							<h6 className="font-medium text-xl">{product.name}</h6>
							<p className="text-sm">{product.sales} sales</p>
						</div>
						<div className="text-right shrink-0">
							<h6 className="font-bold text-xl">${product.revenue.toLocaleString()}</h6>
							<p className="text-sm">Stock: {product.stock}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
