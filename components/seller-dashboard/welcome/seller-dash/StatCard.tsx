import Image from "next/image";
import { StatCard as StatCardType } from "@/data/seller-dashboard-data";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
	card: StatCardType;
}

export function StatCard({ card }: StatCardProps) {
	return (
		<div className="rounded-lg p-6 border shadow overflow-hidden">
			<div className="flex items-start justify-between mb-4">
				<div>
					<h6 className="text-lg font-bold mb-2">{card.title}</h6>
					<h2 className="text-3xl md:text-5xl font-bold">{card.value}</h2>
				</div>
				<div className={`${card.iconColor} w-10 h-10 rounded-md flex items-center justify-center shrink-0`}>
					<Image src={card.icon} alt={card.title} width={20} height={20} className="w-5 h-5" />
				</div>
			</div>

			<div className={`flex items-center gap-3 ${card.isPositive ? "text-green-600" : "text-red-600"}`}>
				<span className="font-semibold">
					{card.isPositive ? "+" : ""}
					{card.percentage.toFixed(1)}%
				</span>
				{card.isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
				<span className="text-primary-body font-medium">vs Yesterday</span>
			</div>
		</div>
	);
}
