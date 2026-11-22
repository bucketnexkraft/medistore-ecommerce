"use client";

import { Luminex } from "@/components/luminex/Luminex";
import Image from "next/image";
import { useRef } from "react";

export function LuminexLauncher() {
	const luminexRef = useRef<HTMLDivElement>(null);

	const handleLuminexClick = () => {
		const button = luminexRef.current?.querySelector("button");
		if (button instanceof HTMLButtonElement) {
			button.click();
		}
	};

	return (
		<div
			ref={luminexRef}
			className="fixed bottom-6 md:right-14 right-4 z-50 bg-white md:pr-16 pr-6 shadow-[0_0_16px_0_rgba(0,0,0,0.4)] border-b border-secondary-stroke rounded-lg cursor-pointer"
		>
			<div onClick={handleLuminexClick} className="flex items-center">
				<Image src="/images/luminex/lumi.gif" alt="luminex" width={100} height={60} />
				<div>
					<h6 className="font-bold">Luminex</h6>
					<span className="text-sm font-semibold">Your AI Shopping Assistant</span>
				</div>
			</div>
			<Luminex />
		</div>
	);
}
