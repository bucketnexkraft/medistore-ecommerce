"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { settingsMenuItems } from "@/data/user-dashboard-data";
import Image from "next/image";

export function SettingsNav() {
	const pathname = usePathname();

	const isActive = (route: string) => {
		return pathname.includes(route);
	};

	return (
		<aside className="bg-white rounded-lg p-4 border shadow">
			<nav className="space-y-1">
				{settingsMenuItems.map((item) => {
					const active = isActive(item.route);
					return (
						<Link
							key={item.id}
							href={`/user-dashboard/settings/${item.route}`}
							className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors duration-200 ${
								active ? "bg-[#BEFACD] font-semibold" : "text-gray-700 hover:bg-[#BEFACD] hover:text-green-700"
							}`}
						>
							{/* <span className="text-lg">{item.icon}</span> */}
							<Image src={item.icon} alt={item.label} width={20} height={20} className="w-5 h-5" />
							<span>{item.label}</span>
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}
