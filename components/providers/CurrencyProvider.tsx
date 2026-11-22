"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";

export type CurrencyOption = {
	id: number | string;
	name: string;
	code: string;
	symbol: string;
	exchangeRate: number;
	label: string;
	value: string;
	isDefault: boolean;
};

type CurrencyFormat = "left" | "right" | "both";

type CurrencyContextValue = {
	currencies: CurrencyOption[];
	selectedCurrency: CurrencyOption;
	setSelectedCurrency: (currency: CurrencyOption) => void;
	formatAmount: (amount: number, onlyNumber?: boolean, currencySymbol?: string) => string;
	convertAmount: (amount: number) => number;
	precision: number;
	currencyFormat: CurrencyFormat;
	isReady: boolean;
};

const FALLBACK_CURRENCIES: CurrencyOption[] = [
	{ id: "bdt", name: "Bangladeshi Taka", code: "BDT", symbol: "\u09F3", exchangeRate: 1, label: "BDT (\u09F3)", value: "bdt", isDefault: true }
];

const DEFAULT_CURRENCY = FALLBACK_CURRENCIES[0];
const STORAGE_KEY = "arcade-selected-currency";

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const parseCurrency = (item: { id?: number | string; name?: string; code?: string; symbol?: string; exchange_rate?: number; label?: string; is_default?: boolean } | null | undefined) => {
	const code = String(item?.code || "").toUpperCase();
	const symbol = String(item?.symbol || "").trim();

	if (!code) {
		return null;
	}

	return {
		id: item?.id ?? code.toLowerCase(),
		name: String(item?.name || code),
		code,
		symbol,
		exchangeRate: Number(item?.exchange_rate || 1),
		label: String(item?.label || (symbol ? `${code} (${symbol})` : code)),
		value: code.toLowerCase(),
		isDefault: Boolean(item?.is_default),
	} satisfies CurrencyOption;
};

const formatNumericAmount = (amount: number, precision: number) => {
	return Number(amount || 0).toLocaleString(undefined, {
		minimumFractionDigits: precision,
		maximumFractionDigits: precision,
	});
};

const normalizeSettingsObject = (value: unknown): Record<string, unknown> => {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
	const [currencies, setCurrencies] = useState<CurrencyOption[]>(FALLBACK_CURRENCIES);
	const [selectedCurrency, setSelectedCurrencyState] = useState<CurrencyOption>(DEFAULT_CURRENCY);
	const [precision, setPrecision] = useState(2);
	const [currencyFormat, setCurrencyFormat] = useState<CurrencyFormat>("left");
	const [defaultCurrencyCode, setDefaultCurrencyCode] = useState(DEFAULT_CURRENCY.code);
	const [defaultCurrencySymbol, setDefaultCurrencySymbol] = useState(DEFAULT_CURRENCY.symbol);
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		const loadCurrencyConfig = async () => {
			try {
				const [currencyJson, basicJson, configurationJson] = await Promise.all([
					fetchStorefrontJson<{ data?: unknown }>("/landing/currencies"),
					fetchStorefrontJson<{ data?: unknown }>("/landing/settings/basic"),
					fetchStorefrontJson<{ data?: unknown }>("/landing/settings/configurations"),
				]);

				const currencyItems = Array.isArray(currencyJson?.data)
					? currencyJson.data
							.map(parseCurrency)
							.filter((item): item is CurrencyOption => item !== null)
					: [];

				const nextCurrencies = currencyItems.length > 0 ? currencyItems : FALLBACK_CURRENCIES;
				const basicSettings = normalizeSettingsObject(basicJson?.data);
				const configurationSettings = normalizeSettingsObject(configurationJson?.data);

				const nextPrecision = Number(configurationSettings?.precision ?? basicSettings?.precision ?? basicSettings?.decimal_precision ?? 2);
				const nextCurrencyFormat = String(configurationSettings?.currency_format ?? basicSettings?.currency_format ?? "left");
				const nextDefaultCode = String(basicSettings?.currency || configurationSettings?.currency || "").toUpperCase();
				const nextDefaultSymbol = String(basicSettings?.currency_symbol || configurationSettings?.currency_symbol || DEFAULT_CURRENCY.symbol).trim();

				const preferredCurrency =
					nextCurrencies.find((item) => item.isDefault) ||
					nextCurrencies.find((item) => item.code === nextDefaultCode) ||
					nextCurrencies.find((item) => nextDefaultSymbol !== "" && item.symbol === nextDefaultSymbol) ||
					nextCurrencies[0];

				setCurrencies(nextCurrencies);
				setSelectedCurrencyState(preferredCurrency);
				setPrecision(Number.isFinite(nextPrecision) && nextPrecision >= 0 ? nextPrecision : 2);
				setCurrencyFormat(nextCurrencyFormat === "right" || nextCurrencyFormat === "both" ? nextCurrencyFormat : "left");
				setDefaultCurrencyCode(nextDefaultCode || DEFAULT_CURRENCY.code);
				setDefaultCurrencySymbol(nextDefaultSymbol || DEFAULT_CURRENCY.symbol);
			} catch {
			} finally {
				setIsReady(true);
			}
		};

		void loadCurrencyConfig();
	}, []);

	const setSelectedCurrency = useCallback((currency: CurrencyOption) => {
		setSelectedCurrencyState(currency);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(STORAGE_KEY, currency.code);
		}
	}, []);

	const convertAmount = useCallback((amount: number) => {
		const safeAmount = Number(amount || 0);
		const rate = Number(selectedCurrency.exchangeRate || 1);

		return safeAmount * (rate > 0 ? rate : 1);
	}, [selectedCurrency.exchangeRate]);

	const formatAmount = useCallback((amount: number, onlyNumber = false, currencySymbol = "") => {
		const convertedAmount = convertAmount(amount);
		const formattedAmount = formatNumericAmount(convertedAmount, precision);

		if (currencySymbol) {
			return `${formattedAmount} ${currencySymbol}`;
		}

		if (onlyNumber) {
			return formattedAmount;
		}

		const symbol = selectedCurrency.symbol || defaultCurrencySymbol || "$";
		const code = selectedCurrency.code || defaultCurrencyCode || "USD";

		switch (currencyFormat) {
			case "right":
				return `${formattedAmount} ${symbol}`;
			case "both":
				return `${symbol} ${formattedAmount} ${code}`;
			case "left":
			default:
				return `${symbol} ${formattedAmount}`;
		}
	}, [convertAmount, currencyFormat, defaultCurrencyCode, defaultCurrencySymbol, precision, selectedCurrency.code, selectedCurrency.symbol]);

	const value = useMemo<CurrencyContextValue>(
		() => ({
			currencies,
			selectedCurrency,
			setSelectedCurrency,
			formatAmount,
			convertAmount,
			precision,
			currencyFormat,
			isReady,
		}),
		[currencies, selectedCurrency, setSelectedCurrency, formatAmount, convertAmount, precision, currencyFormat, isReady],
	);

	return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
	const context = useContext(CurrencyContext);

	if (!context) {
		throw new Error("useCurrency must be used within a CurrencyProvider");
	}

	return context;
}
