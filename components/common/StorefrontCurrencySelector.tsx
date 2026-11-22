"use client";

import { ChevronDown } from "lucide-react";
import { useCurrency } from "@/components/providers/CurrencyProvider";

export default function StorefrontCurrencySelector({ dark = false }: { dark?: boolean }) {
	const { currencies, selectedCurrency, setSelectedCurrency } = useCurrency();
	const text = dark ? "text-white" : "text-[#242424]";
	const border = dark ? "border-white/70" : "border-[#d8d8d8]";

	return (
		<label className={`relative inline-flex items-center gap-1.5 text-sm ${text}`}>
			<span className="sr-only">Currency</span>
			<select
				aria-label="Select currency"
				value={selectedCurrency.value}
				onChange={(event) => {
					const next = currencies.find((currency) => currency.value === event.target.value);
					if (next) setSelectedCurrency(next);
				}}
				className={`cursor-pointer appearance-none rounded-md border bg-transparent py-1.5 pl-3 pr-7 outline-none ${border}`}
			>
				{currencies.map((currency) => <option key={currency.value} value={currency.value} className="bg-white text-[#242424]">{currency.label}</option>)}
			</select>
			<ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2" />
		</label>
	);
}
