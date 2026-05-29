// Mock prices - in production would fetch from CoinGecko or similar
export const MOCK_PRICES = {
  BTC: 97234,
  ETH: 3456,
  SOL: 198,
  DOGE: 0.38,
  XRP: 2.14,
  ADA: 1.02,
  AVAX: 38,
  DOT: 7.2,
  MATIC: 0.92,
  LINK: 18.5,
};

export function getPrice(symbol) {
  return MOCK_PRICES[symbol?.toUpperCase()] ?? 0;
}

export function getTotalValue(assets) {
  return assets.reduce((sum, a) => sum + (a.amount || 0) * getPrice(a.symbol), 0);
}
