import Image from "next/image";
import { quickActions } from "@/data/seller-dashboard-data";

export function QuickActions() {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
			<div className="w-full h-px bg-gray-200 mb-8" />

			<div className="grid grid-cols-2 gap-4">
				{quickActions.map((action) => (
					<button
						key={action.id}
						className={`${action.bgColor} ${action.hoverColor} cursor-pointer rounded-lg p-6 transition-colors flex flex-col items-center justify-center gap-3 group`}
					>
						<div className="w-10 h-10 relative group">
							<Image src={action.icon} alt={action.label} width={40} height={40} className="w-full h-full group-hover:scale-75 transition" />
						</div>
						<span className="font-medium">{action.label}</span>
					</button>
				))}
			</div>
		</div>
	);
}
