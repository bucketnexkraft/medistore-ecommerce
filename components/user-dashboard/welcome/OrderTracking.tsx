import Link from "next/link";
import { Check, Clock } from "lucide-react";

export type OrderTrackingStep = {
	id: number;
	label: string;
	completed: boolean;
};

export type CurrentOrderData = {
	order_id: string;
	status_label: string;
	estimated_delivery: string | null;
	tracking_note: string;
	is_tracking_inferred: boolean;
	steps: OrderTrackingStep[];
};

export function OrderTracking({ order }: { order: CurrentOrderData | null }) {
	if (!order) {
		return (
			<div className="bg-white rounded-xl border shadow p-6 mb-8">
				<h2 className="text-2xl font-bold mb-2">Current Order Tracking</h2>
				<p className="text-primary-body">No order history is available for this account yet.</p>
			</div>
		);
	}

	return (
		<div className="bg-white rounded-xl border shadow p-6 mb-8">
			<h2 className="text-2xl font-bold mb-2">Current Order Tracking</h2>
			<p className="text-xl font-medium mb-2">Order #{order.order_id}</p>
			<p className="text-primary-body mb-8">{order.status_label}</p>

			<div className="mb-8">
				<div className="flex items-center md:flex-row flex-col md:gap-0 gap-5">
					{order.steps.map((step, index) => {
						const isLastStep = index === order.steps.length - 1;

						return (
							<div key={step.id} className="flex items-center flex-1">
								<div className="flex flex-col items-center z-10">
									<div
										className={`w-14 h-14 rounded-full flex items-center justify-center font-semibold mb-3 shrink-0 ${
											step.completed ? "bg-[#007aff] text-white" : "bg-secondary-stroke text-primary-body"
										}`}
									>
										{step.completed ? <Check size={18} /> : step.id}
									</div>
									<p className="text-center text-gray-700 font-medium">{step.label}</p>
								</div>

								{!isLastStep && <div className={`flex-1 h-0.5 mx-2 -mt-8 ${step.completed ? "bg-[#007aff]" : "bg-secondary-stroke"}`}></div>}
							</div>
						);
					})}
				</div>
			</div>

			<div className="bg-blue-100 rounded-lg p-4 flex items-start justify-between gap-4">
				<div className="flex items-center gap-2">
					<Clock className="text-primary-black" size={18} />
					<p className="font-medium text-primary-black! text-sm sm:text-base">
						<span>{order.estimated_delivery ? "Estimated delivery:" : "Tracking note:"}</span>{" "}
						{order.estimated_delivery || order.tracking_note}
					</p>
				</div>
				<Link href="/user-dashboard/tracking" className="text-primary-blue hover:text-blue-700 font-semibold text-sm whitespace-nowrap">
					View Tracking
				</Link>
			</div>

			{order.is_tracking_inferred ? <p className="mt-3 text-sm text-primary-body">{order.tracking_note}</p> : null}
		</div>
	);
}
