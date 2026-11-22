import Image from "next/image";

export type DashboardCardItem = {
	id: string;
	title: string;
	value: string;
	description: string;
	iconColor: string;
	icon: string;
};

function DashboardCard({ card }: { card: DashboardCardItem }) {
	return (
		<div className="bg-white rounded-xl border shadow p-6">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-xl font-bold">{card.title}</h3>
				<div className={`${card.iconColor} w-10 h-10 rounded-md flex items-center justify-center text-lg`}>
					<Image src={card.icon} alt="card icon" width={20} height={20} />
				</div>
			</div>
			<h5 className="text-3xl md:text-5xl font-bold mb-2">{card.value}</h5>
			<p>{card.description}</p>
		</div>
	);
}

export function DashboardCardsGrid({ cards }: { cards: DashboardCardItem[] }) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
			{cards.map((card) => (
				<DashboardCard key={card.id} card={card} />
			))}
		</div>
	);
}
