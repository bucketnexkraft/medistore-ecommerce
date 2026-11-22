import Image from "next/image";
import React from "react";
import { products } from "@/data/products";
import { BestSellingProductCard } from "./common/BestSellingProducts/BestSellingProductCard";
import ThousandsOfShops from "./common/ThousandsOfShops";

export default function LimitedSale() {
	return (
		<section className="section">
			<div className="bg-[url('/images/deals/limited-sale-bg.webp')] bg-cover md:bg-position-[52%_25%] rounded-bl-lg rounded-br-lg lg:px-24 py-16">
				<div className="flex lg:flex-row flex-col lg:gap-2 gap-10">
					{/* left part */}
					<div className="lg:w-3/5 w-full space-y-4 lg:px-0 px-4 ">
						<div className="flex items-center gap-1.5">
							<Image src="/images/deals/offers2.svg" alt="offers" width={24} height={24} />
							<h6 className="text-white uppercase text-sm font-bold">Limited Time Offers</h6>
						</div>
						<h2 className="lg:text-8xl md:text-6xl text-white text-5xl font-extrabold text-shadow-md text-shadow-red-400">
							40% Sale <br /> This Weekend
						</h2>
					</div>
					{/* right part */}
					<div className="lg:w-2/5 w-full md:h-64 relative">
						{/* <Image src="/images/deals/sale.webp" alt="sell" fill priority className="md;object-cover" /> */}
					</div>
				</div>
			</div>

			{/* Best seller component */}
			<h4 className="mt-16 mb-7">Limited Sell</h4>
			{/* Products Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{products.map((product) => (
					<BestSellingProductCard key={product.id} product={product} />
				))}
			</div>
			<ThousandsOfShops />
			<div className="pb-16" />
		</section>
	);
}
