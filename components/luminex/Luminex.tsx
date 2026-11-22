"use client";

import { useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { LuminexProduct } from "@/data/luminex-data";
import { RecommendedProducts } from "./RecommendedProducts";
import { YourBag } from "./YourBag";
import { LuminexAI } from "./LuminexAI";

export function Luminex() {
	const [bagItems, setBagItems] = useState<LuminexProduct[]>([]);
	const [isBagOpen, setIsBagOpen] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);

	const onClose = () => setIsOpen(false);

	// const openDrawer = () => {
	// 	triggerRef.current?.click();
	// };

	const handleAddToBag = (product: LuminexProduct) => {
		setBagItems([...bagItems, product]);
		setIsBagOpen(true);
	};

	return (
		<>
			{/* Trigger Button - Hidden, used for opening drawer */}
			<button ref={triggerRef} onClick={() => setIsOpen(true)} className="hidden" />
			{/* Main Drawer */}
			<Drawer open={isOpen} onOpenChange={onClose}>
				{/* inset-0 max-h-none max-w-none */}
				<DrawerContent className="w-full h-screen">
					<DrawerTitle className="sr-only">Luminex shopping assistant</DrawerTitle>
					<div className="flex h-full">
						{/* Left Side - Recommended Products */}
						<div className="w-full h-full lg:w-3/4">
							<RecommendedProducts onClose={onClose} onAddToBag={handleAddToBag} />
						</div>

						{/* Right Side - AI Assistant */}
						<LuminexAI />
					</div>
				</DrawerContent>
			</Drawer>

			{/* Your Bag Drawer */}
			<YourBag isOpen={isBagOpen} onClose={() => setIsBagOpen(false)} items={bagItems} />
		</>
	);
}
