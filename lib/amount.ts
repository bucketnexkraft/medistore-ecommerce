import { useCurrency } from "@/components/providers/CurrencyProvider";

export function useAmount() {
	const { formatAmount, convertAmount, selectedCurrency, precision, currencyFormat, isReady } = useCurrency();

	return {
		amount: formatAmount,
		formatAmount,
		convertAmount,
		selectedCurrency,
		precision,
		currencyFormat,
		isReady,
	};
}
