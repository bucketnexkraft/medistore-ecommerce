import React from "react";
import { Button } from "../ui/button";
import Link from "next/link";

export default function ThousandsOfShops() {
	return (
		<div className="mt-14 rounded-20 bg-white border border-secondary-stroke overflow-hidden relative flex justify-between md:flex-row flex-col">
			<div className="md:py-24 py-20 px-6 w-full bg-[url('/images/home/topseller/thousand.webp')] bg-no-repeat xl:bg-right lg:bg-contain">
				<h2 className="text-[40px] leading-snug text-primary font-medium mb-4 text-shadow-md text-shadow-white">1000s of shops with their best for you</h2>
				<p className="text-primary-black! text-shadow-xs text-shadow-white mb-7">All of our sellers are passionate to bring new trends and quality products</p>
				<Button variant="primaryBlack" asChild>
					<Link href="/">Click to visit the b...</Link>
				</Button>
			</div>
		</div>
	);
}
