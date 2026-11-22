"use client";

import { useState } from "react";
import { products } from "@/data/products";
import { TopSeller } from "@/data/topSellers";
import { BestSellingProductCard } from "../BestSellingProducts/BestSellingProductCard";

const TABS = ["All Products", "Best Selling", "Reviews", "About Store", "Q&A"] as const;

interface SellerTabsProps {
	seller: TopSeller;
}

export function SellerTabs({ seller }: SellerTabsProps) {
	const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All Products");

	const allProducts = products;
	const bestSellingProducts = products.filter((p) => p.rating >= 4.8);

	return (
		<div className="lg:w-3/4">
			{/* Tabs Navigation */}
			<div className="border-b border-gray-200 mb-8 overflow-x-auto">
				<div className="flex justify-between gap-8">
					{TABS.map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							className={`pb-4 w-full cursor-pointer text-xl whitespace-nowrap font-medium transition-all border-b-2 ${
								activeTab === tab ? "border-gray-900 text-gray-900 font-bold" : "border-transparent text-gray-600 hover:text-gray-900"
							}`}
						>
							{tab}
						</button>
					))}
				</div>
			</div>

			{/* Tab Content */}
			<div>
				{activeTab === "All Products" && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{allProducts.map((product) => (
							<BestSellingProductCard key={product.id} product={product} />
						))}
					</div>
				)}

				{activeTab === "Best Selling" && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{bestSellingProducts.length > 0 ? (
							bestSellingProducts.map((product) => <BestSellingProductCard key={product.id} product={product} />)
						) : (
							<p className="text-gray-500 col-span-full">No best-selling products available</p>
						)}
					</div>
				)}

				{activeTab === "Reviews" && (
					<div className="space-y-6">
						{[1, 2, 3].map((i) => (
							<div key={i} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
								<div className="flex items-start justify-between mb-3">
									<div>
										<p className="font-semibold text-gray-900">John Doe</p>
										<p className="text-sm text-gray-500">2 days ago</p>
									</div>
									<span className="text-yellow-400">⭐⭐⭐⭐⭐</span>
								</div>
								<p className="text-gray-700">
									Great quality products and fast shipping! The seller was very helpful and responsive. Would definitely order again!
								</p>
							</div>
						))}
					</div>
				)}

				{activeTab === "About Store" && (
					<div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
						<h3 className="text-2xl font-bold text-gray-900 mb-4">About {seller.name}</h3>
						<div className="space-y-4 text-gray-700 leading-relaxed">
							<p>
								{seller.name} is a trusted online retailer specializing in high-quality electronics and gadgets. With over{" "}
								{seller.totalReviews.toLocaleString()} customer reviews, we pride ourselves on delivering excellent products and outstanding customer service.
							</p>
							<p>Our mission is to provide customers with the best selection of quality products at competitive prices, with fast and reliable shipping.</p>
							<p>
								<strong>Why Choose Us?</strong>
							</p>
							<ul className="list-disc list-inside space-y-2">
								<li>100% Authentic Products</li>
								<li>Fast & Free Shipping on Orders Over $50</li>
								<li>30-Day Money-Back Guarantee</li>
								<li>24/7 Customer Support</li>
								<li>Secure Payment Options</li>
							</ul>
						</div>
					</div>
				)}

				{activeTab === "Q&A" && (
					<div className="space-y-6">
						{[1, 2, 3].map((i) => (
							<div key={i} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
								<div className="mb-4">
									<p className="font-semibold text-gray-900 mb-2">Q: What is the warranty period?</p>
									<p className="text-gray-700 ml-4">A: All products come with a 12-month manufacturer warranty covering any manufacturing defects.</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
