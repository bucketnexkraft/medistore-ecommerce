"use client";

import Image from "next/image";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { LuminexProduct } from "@/data/luminex-data";

interface YourBagProps {
	isOpen: boolean;
	onClose: () => void;
	items: LuminexProduct[];
}

export function YourBag({ isOpen, onClose, items }: YourBagProps) {
	return (
		<Drawer open={isOpen} onOpenChange={onClose}>
			<DrawerContent className="h-screen w-full lg:w-1/4 ">
				<DrawerTitle className="sr-only">Your bag</DrawerTitle>
				{/* Header */}
				<div className="border-b border-gray-200 p-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold text-gray-900">Your bag ({items.length} items)</h2>
					<button onClick={onClose} className="text-gray-600 hover:text-gray-900 font-medium text-sm cursor-pointer">
						Close
					</button>
				</div>

				{/* Bag Items */}
				<div className="flex-1 overflow-y-auto p-4 space-y-4 grid md:grid-cols-2 grid-cols-1">
					{items.length === 0 ? (
						<div className="text-center py-8 text-gray-500">Your bag is empty</div>
					) : (
						items.map((item) => (
							<div key={item.id} className="flex flex-col items-center gap-4 pb-4">
								<div className="w-24 h-24 bg-gray-100 relative overflow-hidden rounded-full">
									<Image src={item.image} alt={item.title} fill className="w-full h-full object-cover" />
								</div>
								<div className="flex-1 min-w-0 text-center">
									<p className="font-semibold text-gray-900 text-sm line-clamp-2">{item.title}</p>
									<p className="text-gray-600 text-sm mt-1">${item.price.toFixed(2)}</p>
									<button className="text-red-600 hover:text-red-700 text-xs font-medium mt-2">Remove from Bag</button>
								</div>
							</div>
						))
					)}
				</div>

				{/* Footer */}
				{items.length > 0 && (
					<div className="border-t border-gray-200 p-4 space-y-3">
						<button className="w-full bg-black text-white py-3 rounded font-semibold hover:bg-gray-800 transition-colors">Buy All</button>
					</div>
				)}
			</DrawerContent>
		</Drawer>
	);
}
