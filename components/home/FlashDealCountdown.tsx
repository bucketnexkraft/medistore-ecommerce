"use client";

import { useEffect, useMemo, useState } from "react";

type CountdownParts = {
	days: string;
	hours: string;
	minutes: string;
	seconds: string;
};

const zeroParts: CountdownParts = {
	days: "00",
	hours: "00",
	minutes: "00",
	seconds: "00",
};

function getCountdownParts(target: string | null | undefined, currentMs: number): CountdownParts {
	if (!target) {
		return zeroParts;
	}

	const endTime = new Date(target).getTime();

	if (Number.isNaN(endTime)) {
		return zeroParts;
	}

	const remainingMs = Math.max(endTime - currentMs, 0);
	const totalSeconds = Math.floor(remainingMs / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return {
		days: String(days).padStart(2, "0"),
		hours: String(hours).padStart(2, "0"),
		minutes: String(minutes).padStart(2, "0"),
		seconds: String(seconds).padStart(2, "0"),
	};
}

export default function FlashDealCountdown({ endsAt }: { endsAt?: string | null }) {
	const [nowMs, setNowMs] = useState(() => Date.now());

	const countdown = useMemo(() => getCountdownParts(endsAt, nowMs), [endsAt, nowMs]);

	useEffect(() => {
		if (!endsAt) {
			return;
		}

		const timer = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1000);

		return () => window.clearInterval(timer);
	}, [endsAt]);

	return (
		<div className="flex flex-wrap gap-3">
			{[
				{ label: "Days", value: countdown.days },
				{ label: "Hours", value: countdown.hours },
				{ label: "Min", value: countdown.minutes },
				{ label: "Sec", value: countdown.seconds },
			].map((item) => (
				<div key={item.label} className="min-w-18 rounded-2xl border border-[#f3d9c7] bg-white/80 px-3 py-2 text-center shadow-sm">
					<div className="text-xl font-bold text-primary-black">{item.value}</div>
					<div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-body">{item.label}</div>
				</div>
			))}
		</div>
	);
}
