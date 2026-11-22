"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import { useAmount } from "@/lib/amount";

type GroupDealCardProps = {
	card: {
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
};

export function GroupDealCard({ card }: GroupDealCardProps) {
	const { formatAmount } = useAmount();
	const activeGroup = card.active_group;

	return (
		<div className="overflow-hidden rounded-[28px] border border-[#ece7df] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
			<div className="relative h-60 bg-[#f6efe6]">
				<SafeImage unoptimized src={card.product.thumbnail} alt={card.product.name} fill className="object-cover" />
				<div className="absolute left-4 top-4 rounded-full bg-primary-green px-3 py-1 text-xs font-semibold text-white">Group Deal</div>
			</div>

			<div className="space-y-4 p-5">
				<h3 className="line-clamp-2 text-xl font-semibold text-primary-black">{card.product.name}</h3>

				<div className="flex items-end gap-2">
					<span className="text-2xl font-semibold text-primary-black">{formatAmount(card.group_purchase.discounted_price)}</span>
					<span className="text-sm text-primary-body line-through">{formatAmount(card.product.price)}</span>
				</div>

				<div className="flex items-center justify-between text-sm text-primary-body">
					<div className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						<span>{card.group_purchase.minimum_users} members total</span>
					</div>
					<span className="font-semibold text-primary-green">Save {formatAmount(card.group_purchase.discount_value)}</span>
				</div>

				{activeGroup ? (
					<p className="text-sm text-primary-body">
						{activeGroup.joined_count} of {activeGroup.minimum_users} members joined in an active group.
					</p>
				) : (
					<p className="text-sm text-primary-body">
						Invite {Math.max(card.group_purchase.minimum_users - 1, 1)} more friend{card.group_purchase.minimum_users - 1 === 1 ? "" : "s"} to unlock bigger discount.
					</p>
				)}

				<Link
					href={activeGroup ? `/group-purchase?group=${encodeURIComponent(activeGroup.id)}` : `/group-purchase?product=${encodeURIComponent(card.product.id)}`}
					className="inline-flex w-full items-center justify-center rounded-md bg-primary-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-black"
				>
					{activeGroup ? "Open Group Purchase" : "Start Group Purchase"}
				</Link>
			</div>
		</div>
	);
}
