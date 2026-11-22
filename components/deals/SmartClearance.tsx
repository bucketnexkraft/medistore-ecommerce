import Image from "next/image";
import React from "react";

export default function SmartClearance() {
	return (
		<section className="section">
			<div className="bg-[#FFFBEB] rounded-bl-lg rounded-br-lg lg:px-24 py-16">
				<div className="flex lg:flex-row flex-col lg:gap-2 gap-10">
					{/* left part */}
					<div className="lg:w-3/5 w-full space-y-4 lg:px-0 px-4">
						<div className="flex items-center gap-1.5">
							<Image src="/images/deals/offers.svg" alt="offers" width={24} height={24} />
							<h6 className="text-[#BB4D00] uppercase text-sm font-bold">Limited Time Offers</h6>
						</div>
						<h2 className="lg:text-5xl text-4xl font-bold">Smart Clearance Deals</h2>
						<p className="leading-4">Perfectly usable products at lower prices</p>
						{/* items */}
						<div className="flex flex-wrap gap-2">
							{["Near Expiry", "Damaged Package", "Overstock", "Last Pieces", "Open Box"].map((item, i) => (
								<div key={i} className="bg-white px-3 py-1.5 rounded-md border">
									<h6 className="font-medium text-sm">{item}</h6>
								</div>
							))}
						</div>
					</div>
					{/* right part */}
					<div className="lg:w-2/5 w-full h-64 relative">
						<Image src="/images/deals/sale.webp" alt="sell" fill priority className="md;object-cover" />
					</div>
				</div>
			</div>
		</section>
	);
}
