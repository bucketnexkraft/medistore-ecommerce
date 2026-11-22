"use client";

import { useState } from "react";
import { Package, Truck, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductDetailsData } from "@/components/product/product-details.types";

interface ProductDetailsBottomPartProps {
	product: ProductDetailsData;
}

const TABS = [
	{ id: "info", label: "Product Info", icon: Package },
	{ id: "delivery", label: "Delivery & Returns", icon: Truck },
	{ id: "reviews", label: "Reviews", icon: Star },
] as const;

export function ProductDetailsBottomPart({ product }: ProductDetailsBottomPartProps) {
	const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("info");
	const stockText = product.stock_display?.stock_display || product.stock_visibility_label || "Stock info unavailable";
	const hasReturnPolicy = product.return_enabled;
	const normalizedReturnConditions = Array.isArray(product.return_condition)
		? product.return_condition.filter((item) => item.trim() !== "")
		: [];

	return (
		<div className="overflow-hidden border border-gray-200">
			<div className="grid grid-cols-3 border-b border-gray-200">
				{TABS.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;

					return (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"flex cursor-pointer items-center justify-center gap-2 px-6 py-5 font-medium transition-all",
								isActive ? "border-b border-primary-black text-primary-black" : "border-b border-gray-200 text-gray-600 hover:text-gray-900",
							)}
						>
							<Icon size={20} />
							<span className="hidden sm:inline">{tab.label}</span>
						</button>
					);
				})}
			</div>

			<div className="p-6 sm:p-8">
				{activeTab === "info" && (
					<div className="space-y-6">
						<div>
							<h3 className="mb-4 text-lg font-bold text-gray-900">Key Features</h3>
							<ul className="space-y-3">
								<li className="flex gap-3">
									<span className="font-bold text-blue-600">*</span>
									<span className="text-gray-700">Category: {product.category?.name || "N/A"}</span>
								</li>
								<li className="flex gap-3">
									<span className="font-bold text-blue-600">*</span>
									<span className="text-gray-700">Brand: {product.brand?.name || "N/A"}</span>
								</li>
								<li className="flex gap-3">
									<span className="font-bold text-blue-600">*</span>
									<span className="text-gray-700">Stock: {stockText}</span>
								</li>
								<li className="flex gap-3">
									<span className="font-bold text-blue-600">*</span>
									<span className="text-gray-700">VAT: {product.vat}%</span>
								</li>
								<li className="flex gap-3">
									<span className="font-bold text-blue-600">*</span>
									<span className="text-gray-700">Unit: {product.unit ? `${product.unit.name}${product.unit.code ? ` (${product.unit.code})` : ""}` : "N/A"}</span>
								</li>
							</ul>
						</div>

						{product.variants_display.length > 0 ? (
							<div>
								<h3 className="mb-4 text-lg font-bold text-gray-900">Variants</h3>
								<div className="flex flex-wrap gap-2">
									{product.variants_display.map((variant) => (
										<span key={variant} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700">
											{variant}
										</span>
									))}
								</div>
							</div>
						) : null}

						{product.demand_tags.length > 0 ? (
							<div>
								<h3 className="mb-4 text-lg font-bold text-gray-900">Demand Tags</h3>
								<div className="flex flex-wrap gap-2">
									{product.demand_tags.map((tag) => (
										<span key={tag} className="rounded-full bg-[#eefbf0] px-3 py-1 text-sm font-medium capitalize text-primary-green">
											{tag.replaceAll("_", " ")}
										</span>
									))}
								</div>
							</div>
						) : null}

						<div>
							<h3 className="mb-4 text-lg font-bold text-gray-900">Description</h3>
							<div className="leading-relaxed text-gray-700">
								{product.description ? (
									<div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
								) : (
									<p>Detailed product information will be available soon.</p>
								)}
							</div>
						</div>
					</div>
				)}

				{activeTab === "delivery" && (
					<div className="space-y-6">
						<div>
							<h3 className="mb-4 text-lg font-bold text-gray-900">Return Policy</h3>
							{hasReturnPolicy ? (
								<div className="space-y-4 text-gray-700">
									<ul className="space-y-3">
										<li className="flex gap-3">
											<span className="font-bold text-blue-600">*</span>
											<span>
												{product.return_day && product.return_day > 0
													? `Return available within ${product.return_day} day${product.return_day === 1 ? "" : "s"} of delivery.`
													: "This product is marked as returnable."}
											</span>
										</li>
										<li className="flex gap-3">
											<span className="font-bold text-blue-600">*</span>
											<span>Return approval may depend on item condition, verification, and seller review.</span>
										</li>
									</ul>

									{normalizedReturnConditions.length > 0 ? (
										<div>
											<p className="mb-3 font-semibold text-gray-900">Return Conditions</p>
											<ul className="space-y-3">
												{normalizedReturnConditions.map((condition) => (
													<li key={condition} className="flex gap-3">
														<span className="font-bold text-blue-600">*</span>
														<span>{condition}</span>
													</li>
												))}
											</ul>
										</div>
									) : null}
								</div>
							) : (
								<ul className="space-y-3 text-gray-700">
									<li className="flex gap-3">
										<span className="font-bold text-blue-600">*</span>
										<span>This product is currently not marked as returnable.</span>
									</li>
									<li className="flex gap-3">
										<span className="font-bold text-blue-600">*</span>
										<span>If you receive a damaged or incorrect item, please contact support with your order details for assistance.</span>
									</li>
								</ul>
							)}
						</div>
					</div>
				)}

				{activeTab === "reviews" && (
					<div className="space-y-6">
						<div className="grid gap-4 md:grid-cols-[260px_1fr]">
							<div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
								<p className="text-4xl font-bold text-gray-900">{product.average_rating.toFixed(1)}</p>
								<div className="mt-3 flex justify-center gap-1 text-yellow-400">
									{[...Array(5)].map((_, i) => (
										<span key={i}>{i < Math.round(product.average_rating || 0) ? "★" : "☆"}</span>
									))}
								</div>
								<p className="mt-3 text-sm text-gray-600">
									{product.reviews_count} review{product.reviews_count === 1 ? "" : "s"}
								</p>
							</div>

							<div className="space-y-4">
								{product.reviews.length > 0 ? (
									product.reviews.map((review) => (
										<div key={review.id} className="rounded-xl border border-gray-200 bg-white p-5">
											<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
												<div>
													<p className="font-semibold text-gray-900">{review.reviewer}</p>
													<p className="mt-1 text-sm text-gray-500">
														{review.created_at ? new Date(review.created_at).toLocaleDateString() : "Recent review"}
													</p>
												</div>
												<div className="flex gap-1 text-yellow-400">
													{[...Array(5)].map((_, i) => (
														<span key={i}>{i < review.rating ? "★" : "☆"}</span>
													))}
												</div>
											</div>
											<p className="mt-4 leading-relaxed text-gray-700">
												{review.comment || "Customer rated this product."}
											</p>
										</div>
									))
								) : (
									<div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
										<p className="text-lg font-semibold text-gray-900">No reviews yet</p>
										<p className="mt-2 text-gray-600">Be the first customer to rate this product after purchase.</p>
									</div>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
