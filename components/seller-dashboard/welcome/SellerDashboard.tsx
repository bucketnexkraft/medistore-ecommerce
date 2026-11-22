"use client";

import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";
import { statCards } from "@/data/seller-dashboard-data";
import { StatCard } from "./seller-dash/StatCard";
import { RevenueTrendChart } from "./seller-dash/RevenueTrendChart";
import { OrderTrendChart } from "./seller-dash/OrderTrendChart";
import { PerformanceScoreChart } from "./seller-dash/PerformanceScoreChart";
import { TopSellingProducts } from "./seller-dash/TopSellingProducts";
import { QuickActions } from "./seller-dash/QuickActions";
import { LowStockAlerts } from "./seller-dash/LowStockAlerts";
import { PendingReturnRequests } from "./seller-dash/PendingReturnRequests";
import { PendingMessages } from "./seller-dash/PendingMessages";

export function SellerDashboard() {
	return (
		<main className="flex-1 overflow-y-auto">
			{/* Title */}
			<UserDashTitle title="Dashboard" subtitle="Discover your dashboard" />

			{/* Stat Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				{statCards.map((card) => (
					<StatCard key={card.id} card={card} />
				))}
			</div>

			{/* Chart Cards */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
				<div className="lg:col-span-1">
					<RevenueTrendChart />
				</div>
				<div className="lg:col-span-1">
					<OrderTrendChart />
				</div>
				<div className="lg:col-span-1">
					<PerformanceScoreChart />
				</div>
			</div>

			{/* Top Selling & Quick Actions */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
				<div className="lg:col-span-2">
					<TopSellingProducts />
				</div>
				<div className="lg:col-span-1">
					<QuickActions />
				</div>
			</div>

			{/* Low Stock, Returns, Messages */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<div>
					<LowStockAlerts />
				</div>
				<div>
					<PendingReturnRequests />
				</div>
				<div>
					<PendingMessages />
				</div>
			</div>
		</main>
	);
}
