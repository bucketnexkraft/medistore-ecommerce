"use client";

import { useState } from "react";
import { pendingReturnRequests } from "@/data/seller-dashboard-data";

export function PendingReturnRequests() {
	const [showAll, setShowAll] = useState(false);

	const displayedRequests = showAll ? pendingReturnRequests : pendingReturnRequests.slice(0, 3);

	return (
		<div className="bg-white rounded-lg border border-gray-200">
			<h2 className="text-xl font-bold p-6 border-b">Pending Return Requests</h2>

			<div className="space-y-4 p-6">
				{displayedRequests.map((request) => (
					<div key={request.id} className="border border-gray-200 rounded-lg p-4">
						<div className="flex items-start justify-between mb-2">
							<div>
								<h6 className="font-semibold text-sm">{request.orderId}</h6>
								<p className="text-xs font-medium">{request.customerName}</p>
							</div>
							<span className="bg-yellow-100 text-yellow-500 border border-yellow-500 text-xs px-2.5 py-1 rounded-lg font-semibold">Pending</span>
						</div>

						<p className="text-sm font-medium mb-2">{request.productName}</p>
						<p className="text-xs text-gray-600">
							Reason: {request.reason} • {request.timestamp}
						</p>
					</div>
				))}
			</div>

			{!showAll ? (
				<button
					onClick={() => setShowAll(true)}
					className="text-primary-blue hover:text-purple-700 cursor-pointer font-semibold text-sm pb-8 block w-fit mx-auto"
				>
					View all returns
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
