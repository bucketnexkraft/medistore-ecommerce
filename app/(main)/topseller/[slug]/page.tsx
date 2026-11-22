"use client";

import { notFound } from "next/navigation";
import Image from "next/image";
import { topSellers } from "@/data/topSellers";
import { SellerDetailsInfo } from "@/components/common/TopSeller/SellerDetailsInfo";
import { SellerTabs } from "@/components/common/TopSeller/SellerTabs";
import { TopSellerCards } from "@/components/common/TopSeller/TopSellerCards";
import ThousandsOfShops from "@/components/common/ThousandsOfShops";

interface SellerDetailsPageProps {
	params: Promise<{
		slug: string;
	}>;
}

export default async function SellerDetailsPage({ params }: SellerDetailsPageProps) {
	const { slug } = await params;
	const seller = topSellers.find((s) => s.slug === slug);

	if (!seller) {
		notFound();
	}

	return <SellerDetailsPageContent seller={seller} />;
}

function SellerDetailsPageContent({ seller }: { seller: (typeof topSellers)[0] }) {
	return (
		<main className="container mx-auto lg:px-0 px-4">
			{/* Cover Image */}
			<div className="relative w-full h-64 sm:h-80 md:h-96 overflow-hidden rounded-lg md:rounded-2xl lg:mt-6 mt-4">
				<Image src="/images/home/topseller/details-cover.webp" alt={seller.name} fill className="object-cover" priority />
			</div>

			{/* Content Section */}
			<div className="py-12 pb-10">
				<div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
					{/* Left Sidebar */}
					<SellerDetailsInfo seller={seller} />

					{/* Right Content - Tabs */}
					<SellerTabs seller={seller} />
				</div>
			</div>
			{/* content section two */}
			<div className="pb-14">
				<h4 className="">Discover Other Sellers</h4>
				<TopSellerCards />
				<ThousandsOfShops />
			</div>
		</main>
	);
}
