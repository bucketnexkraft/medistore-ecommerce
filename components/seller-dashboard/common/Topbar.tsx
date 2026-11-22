"use client";
import { useAuth } from "@/components/providers/AuthProvider";
import { getUserDisplayName, getUserInitials } from "@/lib/auth";
import Image from "next/image";
import React, { useState } from "react";

const topbarIcons = [
	{ id: "notification", icon: "/icons/seller-dashboard/notification.svg", alt: "Notifications" },
	{ id: "message", icon: "/icons/seller-dashboard/message.svg", alt: "Messages" },
	{ id: "info", icon: "/icons/seller-dashboard/info.svg", alt: "Info" },
];

export default function Topbar() {
	const [open, setOpen] = useState(false);
	const { logout, user } = useAuth();
	return (
		<div className="py-5 mb-8">
			<div className="flex justify-between items-center lg:flex-row flex-col gap-10">
				{/* Search Bar */}
				<div className="relative lg:w-2/5 w-full">
					<input
						type="text"
						placeholder="Search any product..."
						className="h-10 w-full rounded-full border border-border px-4 pr-10 text-sm font-medium text-foreground placeholder:text-primary-body outline-none "
					/>
					<Image
						src="/images/header/search.svg"
						alt="Search"
						width={18}
						height={18}
						className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
					/>
				</div>

				{/* notification and profile */}
				<div className="flex items-center gap-4">
					{/* Icons */}
					<div className="flex items-center gap-3">
						{topbarIcons.map((item) => (
							<button key={item.id} className="relative cursor-pointer">
								<Image src={item.icon} alt={item.alt} width={20} height={20} />
								{/* red dot (optional) */}
								<span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500"></span>
							</button>
						))}
					</div>

					{/* Divider */}
					<div className="hidden sm:block h-6 w-px bg-gray-300"></div>

					{/* Profile Dropdown */}
					<div className="relative">
						<button onClick={() => setOpen(!open)} className="flex items-center gap-2 cursor-pointer">
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-[#AD46FF] to-[#F6339A] text-white text-sm font-semibold">
								{getUserInitials(user)}
							</div>

							<span className="hidden sm:block text-sm font-medium">{getUserDisplayName(user)}</span>

							<Image src="/icons/seller-dashboard/arrow-down.svg" alt="dropdown" width={16} height={16} />
						</button>

						{/* Dropdown Menu */}
						{open && (
							<div className="absolute right-0 mt-2 w-52 rounded-xl bg-white shadow-lg border border-gray-100 py-2 z-50">
								<button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 cursor-pointer">My Profile</button>
								<button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 cursor-pointer">Store Settings</button>
								<button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 cursor-pointer">Orders</button>
								<button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 cursor-pointer">Earnings</button>
								<button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 cursor-pointer">Support</button>

								<div className="my-1 border-t"></div>

								<button
									type="button"
									onClick={() => void logout()}
									className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 cursor-pointer"
								>
									Logout
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
