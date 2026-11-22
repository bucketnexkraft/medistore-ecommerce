"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { getUserDisplayName } from "@/lib/auth";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationRoutes } from "@/data/user-dashboard-data";

export function Sidebar() {
	const pathname = usePathname();
	const [isOpen, setIsOpen] = useState(false);
	const { logout, user } = useAuth();

	const isActive = (href: string) => {
		// Special handling for settings parent
		if (href.startsWith("/user-dashboard/settings")) {
			return pathname.startsWith("/user-dashboard/settings");
		}

		return pathname === href;
	};
	return (
		<>
			{/* Mobile Menu Button */}
			{/* <button onClick={() => setIsOpen(!isOpen)} className="md:hidden fixed bottom-4 right-4 z-50 bg-green-500 text-blue-500 p-3 rounded-full shadow-lg">
				☰
			</button> */}

			{/* Sidebar */}
			<aside
				className={`bg-white border border-secondary-stroke shadow rounded-xl p-6 overflow-y-auto transition-transform duration-300${
					isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
				}`}
			>
				{/* User Profile */}
				<div className="mb-8 pb-6 border-b border-gray-200">
					<div className="flex items-center gap-4">
						<div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
							{user?.profile_image ? (
								<Image
									loader={({ src }) => src}
									unoptimized
									src={user.profile_image}
									alt={getUserDisplayName(user)}
									width={64}
									height={64}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center text-lg font-semibold text-primary-body">
									{getUserDisplayName(user).charAt(0).toUpperCase()}
								</div>
							)}
						</div>
						<div>
							<p className="text-sm">User</p>
							<h6 className="font-medium">{getUserDisplayName(user)}</h6>
						</div>
					</div>
				</div>

				{/* Navigation */}
				<nav className="space-y-1">
					{navigationRoutes.map((route) => {
						const active = isActive(route.href);

						return (
							<Link
								key={route.id}
								href={route.href}
								onClick={() => setIsOpen(false)}
								className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200 ${
									active ? "bg-[#BEFACD] font-semibold" : "text-gray-700 hover:bg-[#BEFACD] hover:text-green-700"
								}`}
							>
								<Image src={route.icon} alt={route.label} width={20} height={20} className="w-5 h-5" />
								<span>{route.label}</span>
							</Link>
						);
					})}
				</nav>

				<button
					type="button"
					onClick={() => void logout()}
					className="mt-6 flex w-full items-center justify-center rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50"
				>
					Sign out
				</button>
			</aside>

			{/* Backdrop for Mobile */}
			{isOpen && <div className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-30" onClick={() => setIsOpen(false)}></div>}
		</>
	);
}
