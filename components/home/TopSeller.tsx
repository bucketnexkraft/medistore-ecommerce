import Link from "next/link";
import React from "react";
import { TopSellerCards } from "../common/TopSeller/TopSellerCards";
import ThousandsOfShops from "../common/ThousandsOfShops";

export default function TopSeller() {
	return (
		<section className="bg-primary-black py-14">
			<div className="section">
				<div className="flex md:flex-row flex-col gap-5 justify-between items-center">
					<h4 className="text-bg!">Top Seller</h4>
					<Link href="/all-seller" className="bg-theme-coral hover:bg-red-500 text-bg text-sm py-2 px-4 rounded-lg">
						See all seller
					</Link>
				</div>
				<TopSellerCards />
				<ThousandsOfShops />
			</div>
		</section>
	);
}
