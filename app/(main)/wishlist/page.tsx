import { RequireAuth } from "@/components/auth/RequireAuth";
import ThousandsOfShops from "@/components/common/ThousandsOfShops";
import { Wishlist } from "@/components/wishlist/Wishlist";
import React from "react";

export default function page() {
	return (
		<div>
			<RequireAuth>
				<Wishlist />
			</RequireAuth>
			<div className="section -mt-14 pb-14">
				<ThousandsOfShops />
			</div>
		</div>
	);
}
