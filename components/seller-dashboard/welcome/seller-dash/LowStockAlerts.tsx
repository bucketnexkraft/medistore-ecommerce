"use client";

import { useState } from "react";
import { lowStockAlerts } from "@/data/seller-dashboard-data";
import { AlertTriangle } from "lucide-react";

export function LowStockAlerts() {
	const [showAll, setShowAll] = useState(false);

	const displayedAlerts = showAll ? lowStockAlerts : lowStockAlerts.slice(0, 3);

	return (
		<div className="bg-white rounded-lg border border-gray-200">
			<h2 className="text-xl font-bold p-6 border-b">Low Stock Alerts</h2>

			<div className="space-y-3 p-6">
				{displayedAlerts.map((alert) => (
					<div key={alert.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
						<div className="flex items-start gap-3">
							<AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
							<div className="flex-1 min-w-0 space-y-0.5">
								<h6 className="font-semibold">{alert.name}</h6>
								<p className="text-xs font-medium">SKU: {alert.sku}</p>
								<p className="text-xs text-yellow-500! font-medium">
									Only {alert.stock} left (threshold: {alert.threshold})
								</p>
							</div>
						</div>
					</div>
				))}
			</div>

			{!showAll ? (
				<button
					onClick={() => setShowAll(true)}
					className="text-primary-blue hover:text-purple-700 cursor-pointer font-semibold text-sm pb-8 block w-fit mx-auto"
				>
					View inventory
				</button>
			) : (
				<button
					onClick={() => setShowAll(false)}
					className="text-primary-blue hover:text-purple-700 cursor-pointer font-semibold text-sm pb-8 block w-fit mx-auto"
				>
					Show less
				</button>
			)}
		</div>
	);
}
