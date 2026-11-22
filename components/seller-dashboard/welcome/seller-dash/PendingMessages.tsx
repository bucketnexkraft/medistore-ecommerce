"use client";

import { useState } from "react";
import { pendingMessages } from "@/data/seller-dashboard-data";

export function PendingMessages() {
	const [showAll, setShowAll] = useState(false);

	const displayedMessages = showAll ? pendingMessages : pendingMessages.slice(0, 3);

	return (
		<div className="bg-white rounded-lg border border-gray-200">
			<h2 className="text-xl font-bold p-6 border-b">Pending Message Requests</h2>

			<div className="space-y-4 p-6">
				{displayedMessages.map((msg) => (
					<div key={msg.id} className="border border-gray-200 rounded-lg p-4">
						<div className="flex items-start gap-3">
							<div className={`${msg.avatarColor} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
								{msg.customerInitials}
							</div>
							<div className="flex-1 min-w-0">
								<p className="font-semibold text-gray-900 text-sm">{msg.customerName}</p>
								<p className="text-sm text-gray-700 mt-1">{msg.message}</p>
								<p className="text-xs text-gray-600 mt-2">{msg.timestamp}</p>
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
					View all messages
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
