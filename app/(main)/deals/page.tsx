import ThousandsOfShops from "@/components/common/ThousandsOfShops";
import { DealsProducts } from "@/components/deals/DealsProducts";
import SmartClearance from "@/components/deals/SmartClearance";
import React from "react";

export default function page() {
	return (
		<div>
			<SmartClearance />
			<DealsProducts />
		</div>
	);
}
