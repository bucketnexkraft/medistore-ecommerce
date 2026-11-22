import { RequireAuth } from "@/components/auth/RequireAuth";
import { Wishlist } from "@/components/wishlist/Wishlist";

export default function page() {
	return (
		<RequireAuth>
			<Wishlist />
		</RequireAuth>
	);
}
