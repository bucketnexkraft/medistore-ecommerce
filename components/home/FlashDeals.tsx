import Link from "next/link";
import { Bolt, ChevronRight } from "lucide-react";
import StorefrontProductCard from "@/components/common/product/StorefrontProductCard";
import SafeImage from "@/components/common/SafeImage";
import FlashDealCountdown from "@/components/home/FlashDealCountdown";
import { type FlashDealsSection } from "@/lib/flash-deals";

function formatMeta(rating: number | null, reviews: number) {
	if (reviews > 0 && typeof rating === "number") {
		return `${rating.toFixed(1)} rating`;
	}

	return "Limited";
}

function formatFooter(quantity: number | undefined, reviews: number) {
	const stockLabel = Number(quantity || 0) > 0 ? `${Math.floor(Number(quantity || 0))} in stock` : "Selling fast";

	if (reviews > 0) {
		return `${reviews} review${reviews === 1 ? "" : "s"} | ${stockLabel}`;
	}

	return stockLabel;
}

export default function FlashDeals({ initialSection }: { initialSection: FlashDealsSection }) {
	const heroProduct = initialSection.products[0];
	const gridProducts = initialSection.products.slice(heroProduct ? 1 : 0, 5);

	if (!heroProduct && gridProducts.length === 0) {
		return null;
	}

	return (
		<section className="section my-14">
			<div className="overflow-hidden rounded-[30px] border border-[#f3d9c7] bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_45%,#fff1f2_100%)] p-6 shadow-[0_24px_60px_rgba(234,88,12,0.10)] md:p-8 lg:p-10">
				<div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-2xl">
						<div className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white">
							<Bolt className="h-4 w-4 text-[#fb923c]" />
							Flash deal
						</div>
						<h2 className="mt-4 text-3xl font-bold text-primary-black md:text-4xl">{initialSection.heading}</h2>
						<p className="mt-3 text-base leading-7 text-primary-body">{initialSection.subheading}</p>
					</div>

					<div className="flex flex-col items-start gap-4 lg:items-end">
						<FlashDealCountdown endsAt={initialSection.ends_at} />
						<Link
							href={initialSection.button_link || "/products"}
							className="inline-flex items-center gap-2 rounded-full bg-primary-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
						>
							{initialSection.button_text}
							<ChevronRight className="h-4 w-4" />
						</Link>
					</div>
				</div>

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.25fr)]">
					{heroProduct ? (
						<Link
							href={heroProduct.url}
							className="group relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#1f2937_0%,#c2410c_52%,#fb7185_100%)] text-white"
						>
							<div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(15,23,42,0.32)_0%,rgba(15,23,42,0.12)_38%,rgba(255,255,255,0)_100%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.10),transparent_28%)]" />
							<div className="absolute inset-y-0 right-0 w-[44%] bg-gradient-to-l from-white/10 to-transparent" />

							<div className="relative grid h-full gap-6 p-7 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
								<div className="flex h-full flex-col justify-between gap-6">
									<div>
										<div className="inline-flex rounded-full border border-white/15 bg-black/18 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-sm backdrop-blur-sm">
										{heroProduct.badge}
										</div>
										<h3 className="mt-5 max-w-xl text-3xl font-bold leading-tight text-white drop-shadow-[0_3px_10px_rgba(15,23,42,0.28)]">
											{heroProduct.name}
										</h3>
										<p
											className="mt-3 text-base font-semibold drop-shadow-[0_2px_8px_rgba(15,23,42,0.30)]"
											style={{ color: "#f8fafc" }}
										>
											{heroProduct.brand || heroProduct.category}
										</p>
									</div>

									<div className="relative flex min-h-[180px] items-center justify-center rounded-[24px] bg-white/10 p-4 md:hidden">
										<SafeImage
											unoptimized
											src={heroProduct.image}
											alt={heroProduct.name}
											width={220}
											height={220}
											className="max-h-[180px] w-auto object-contain drop-shadow-[0_16px_30px_rgba(15,23,42,0.35)]"
										/>
									</div>

									<div className="flex flex-wrap items-end justify-between gap-4">
										<div>
											<p
												className="text-4xl font-bold drop-shadow-[0_3px_10px_rgba(15,23,42,0.36)]"
												style={{ color: "#ffffff" }}
											>
												${heroProduct.price.toFixed(2)}
											</p>
											{heroProduct.original_price > heroProduct.price ? (
												<div className="mt-2 flex flex-wrap items-center gap-2">
													<p
														className="text-base font-semibold line-through drop-shadow-[0_2px_8px_rgba(15,23,42,0.24)]"
														style={{ color: "#e2e8f0" }}
													>
														${heroProduct.original_price.toFixed(2)}
													</p>
													<span className="rounded-full border border-white/12 bg-black/25 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
														Save {heroProduct.discount_percent || 0}%
													</span>
												</div>
											) : null}
										</div>
										<div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary-black shadow-md transition group-hover:translate-x-1">
											Open deal
										</div>
									</div>
								</div>

								<div className="relative hidden h-full min-h-[240px] md:block">
									<div className="absolute inset-0 rounded-[24px] border border-white/10 bg-white/12 backdrop-blur-[2px]" />
									<div className="relative flex h-full items-center justify-center p-6">
										<SafeImage
											unoptimized
											src={heroProduct.image}
											alt={heroProduct.name}
											width={240}
											height={240}
											className="max-h-[260px] w-auto object-contain drop-shadow-[0_16px_30px_rgba(15,23,42,0.35)] transition duration-300 group-hover:scale-105"
										/>
									</div>
								</div>
							</div>
						</Link>
					) : null}

					<div className="grid gap-5 sm:grid-cols-2">
						{gridProducts.map((product) => (
							<StorefrontProductCard
								key={product.id}
								productId={product.id}
								productSlug={product.slug}
								href={product.url}
								name={product.name}
								imageSrc={product.image}
								badgeText={product.badge}
								metaText={formatMeta(product.rating, product.reviews)}
								price={product.price}
								originalPrice={product.original_price}
								footerText={formatFooter(product.quantity, product.reviews)}
								availableQuantity={Number(product.quantity || 0)}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
