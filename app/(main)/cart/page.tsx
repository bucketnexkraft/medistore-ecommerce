import Link from "next/link";
import { ChevronRight } from "lucide-react";
import CartPageClient from "@/components/cart/CartPageClient";

export default function CartPage() {
	return (
		<main className="pb-16 md:pb-24">
			<section className="section pt-8">
				<div className="flex items-center gap-2 text-sm text-primary-body">
					<Link href="/" className="transition-colors hover:text-primary-black">
						Home
					</Link>
					<ChevronRight className="h-4 w-4" />
					<span className="font-semibold text-primary-black">Cart</span>
				</div>
			</section>

			<section className="section pt-6">
				<CartPageClient />
			</section>
		</main>
	);
}
