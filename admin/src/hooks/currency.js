// price.js
let currencySettings = {
  code: 'USD', // Currency code (ISO 4217, e.g., USD, EUR)
  symbol: '$', // Currency symbol (e.g., $, €)
  exchange_rate: 1,
  precision: 2,
  currency_format: 'left',
};

// Update currency settings
export function setPriceCurrency(settings) {
  const code = String(settings?.code || 'USD').toUpperCase();
  const symbol = String(settings?.symbol || '$');
  currencySettings = {
    code, // Use code from backend
    symbol,
    exchange_rate: Math.max(Number(settings?.exchange_rate || 1), 0),
    precision: Math.max(0, Math.min(6, Number(settings?.precision ?? 2))),
    currency_format: ['left', 'right', 'both'].includes(settings?.currency_format)
      ? settings.currency_format
      : 'left',
  };
}

// Format price (e.g., 10000 -> $10,000.00)
export function formatPrice(amount, locale = 'en-US') {
  const { code, symbol, exchange_rate, precision, currency_format } = currencySettings;
  try {
    const convertedAmount = Number(amount || 0) * exchange_rate;
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });

    const formatted = formatter.format(Number.isFinite(convertedAmount) ? convertedAmount : 0);
    if (!symbol) return `${formatted} ${code}`;
    if (currency_format === 'right') return `${formatted} ${symbol}`;
    if (currency_format === 'both') return `${symbol} ${formatted} ${code}`;
    return `${symbol} ${formatted}`;
  } catch (error) {
    console.warn(`Invalid currency code: ${code}. Using fallback formatting.`, error);
    // Fallback formatting: e.g., $10000.00
    return `${symbol}${Number(amount || 0).toFixed(2)}`;
  }
}

export function onlyCurrencySimble(locale = 'en-US'){
  const { code, symbol } = currencySettings;
  return `${symbol}`;
}
