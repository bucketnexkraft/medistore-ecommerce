import Image from "next/image";
import { TopSellerCards } from "./common/TopSeller/TopSellerCards";
import ThousandsOfShops from "./common/ThousandsOfShops";

export default function BestSeller() {
	return (
		<section className="section">
			<div className="bg-[#FFFBEB] rounded-bl-lg rounded-br-lg lg:px-24 ">
				<div className="flex lg:flex-row flex-col items-center gap-2 ">
					{/* left part */}
					<div className="lg:w-3/5 w-full space-y-4 lg:px-0 px-4 lg:pt-0 pt-10">
						<h2 className="lg:text-8xl md:text-6xl max-lg:text-center text-5xl font-extrabold">
							40% Sale <br /> This Weekend
						</h2>
					</div>
					{/* right part */}
					<div className="lg:w-2/5 w-full lg:h-94 h-64 relative">
						<Image src="/images/deals/deals.webp" alt="sell" fill className="w-full h-full object-contain" />
					</div>
				</div>
			</div>

			{/* Best seller component */}
			<h4 className="mt-16">Best Seller</h4>
			<TopSellerCards />
			<ThousandsOfShops />
			<div className="pb-16" />
		</section>
	);
}
