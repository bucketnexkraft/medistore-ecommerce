"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const LazyLuminexLauncher = dynamic(
	() => import("@/components/luminex/LuminexLauncher").then((mod) => mod.LuminexLauncher),
	{ ssr: false },
);

export function DeferredLuminexLauncher() {
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let idleId: number | null = null;

		const enable = () => setIsReady(true);

		if (typeof window !== "undefined" && "requestIdleCallback" in window) {
			idleId = window.requestIdleCallback(enable, { timeout: 1500 });
		} else {
			timeoutId = setTimeout(enable, 800);
		}

		return () => {
			if (typeof window !== "undefined" && idleId !== null && "cancelIdleCallback" in window) {
				window.cancelIdleCallback(idleId);
			}

			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}
		};
	}, []);

	if (!isReady) {
		return null;
	}

	return <LazyLuminexLauncher />;
}
