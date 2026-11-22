"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { GroupDealCard } from "./GroupDealCard";

type GroupDealCardData = {
	product: {
		id: string;
		name: string;
		slug: string;
		thumbnail: string;
		price: number;
	};
	group_purchase: {
		minimum_users: number;
		discount_value: number;
		discounted_price: number;
	};
	active_group: {
		id: string;
		joined_count: number;
		minimum_users: number;
	} | null;
};

export function GroupDeals() {
	const [cards, setCards] = useState<GroupDealCardData[]>([]);

	useEffect(() => {
		let ignore = false;

		const loadCards = async () => {
			try {
				const response = await apiFetch("/landing/group-purchases?limit=6", {
					cache: "no-store",
				});
				const payload = (await response.json().catch(() => null)) as { status?: number; data?: { cards?: GroupDealCardData[] } } | null;

				if (!ignore && response.ok && payload?.status === 1 && Array.isArray(payload?.data?.cards)) {
					setCards(payload.data.cards);
				}
			} catch {
			}
		};

		void loadCards();

		return () => {
			ignore = true;
		};
	}, []);

	if (cards.length === 0) {
		return null;
	}

	return (
		<section className="section py-14 lg:px-16!">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{cards.map((card) => (
					<GroupDealCard key={card.product.id} card={card} />
				))}
			</div>
		</section>
	);
}
