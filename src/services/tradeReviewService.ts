import { somniaExchange } from '../lib/somniaClient';
import type { NormalizedEventMarket } from '../types/market';
import type { IntentDirection } from '../types/intent';

export interface MarketLivePricing {
  pricePerShare: number; // e.g. 0.45 ($0.45 per contract)
  impliedProbabilityPercent: number; // e.g. 45.0%
  availableLiquidityUsdc: number; // e.g. 420.84 USDC
  bestBid: number | null;
  bestAsk: number | null;
  totalDepthContracts: number;
}

export interface TradeCalculationResult {
  tradeAmountUsdc: number;
  pricePerShare: number;
  estimatedContracts: number;
  potentialPayoutUsdc: number;
  netProfitUsdc: number;
  returnMultiplier: number;
  returnPercent: number;
  availableLiquidityUsdc: number;
  isLiquiditySufficient: boolean;
}

export class TradeReviewService {
  /**
   * Fetches real live order book pricing and depth for a matched event contract and direction.
   */
  public static async getLivePricing(
    market: NormalizedEventMarket,
    direction: IntentDirection
  ): Promise<MarketLivePricing> {
    try {
      // Ensure exchange registry is loaded
      if (Object.keys(somniaExchange.markets).length === 0) {
        await somniaExchange.loadMarkets();
      }

      // Try finding the matching unified symbol
      const marketsList = Object.values(somniaExchange.markets);
      const unifiedMarket = marketsList.find(
        (um) =>
          um.id.toLowerCase() === market.marketId.toLowerCase() ||
          um.symbol.toLowerCase().includes(market.shortMarketId.toLowerCase()) ||
          (um.base === market.asset && Math.abs(Number((um as any).strike || 0) - market.strike) < 0.01)
      );

      let orderBook: { bids: [number, number][]; asks: [number, number][] } | null = null;

      if (unifiedMarket) {
        try {
          orderBook = await somniaExchange.fetchOrderBook(unifiedMarket.symbol);
        } catch {
          // Fallback if specific symbol fetch fails
        }
      }

      // If unified fetch succeeded and has depth
      if (orderBook && (orderBook.bids.length > 0 || orderBook.asks.length > 0)) {
        const bestBid = orderBook.bids[0] ? orderBook.bids[0][0] : null;
        const bestAsk = orderBook.asks[0] ? orderBook.asks[0][0] : null;

        const totalAskLiquidity = orderBook.asks.reduce((sum, [p, q]) => sum + p * q, 0);
        const totalBidLiquidity = orderBook.bids.reduce((sum, [p, q]) => sum + (1 - p) * q, 0);
        const totalDepth = orderBook.asks.reduce((sum, [, q]) => sum + q, 0);

        if (direction === 'UP') {
          const yesPrice = bestAsk ?? (bestBid ? Math.min(0.99, bestBid + 0.02) : 0.50);
          return {
            pricePerShare: Number(yesPrice.toFixed(4)),
            impliedProbabilityPercent: Number((yesPrice * 100).toFixed(1)),
            availableLiquidityUsdc: Number(totalAskLiquidity.toFixed(2)),
            bestBid,
            bestAsk,
            totalDepthContracts: totalDepth,
          };
        } else {
          // DOWN / NO outcome
          // NO price is (1 - bestBid) when buying against the YES book
          const noPrice = bestBid !== null ? Number((1 - bestBid).toFixed(4)) : (bestAsk !== null ? Number((1 - bestAsk).toFixed(4)) : 0.50);
          return {
            pricePerShare: Math.max(0.01, Math.min(0.99, noPrice)),
            impliedProbabilityPercent: Number((Math.max(0.01, Math.min(0.99, noPrice)) * 100).toFixed(1)),
            availableLiquidityUsdc: Number(totalBidLiquidity.toFixed(2)),
            bestBid,
            bestAsk,
            totalDepthContracts: totalDepth,
          };
        }
      }

      // Order book is empty or hydrating: report true zero liquidity
      return {
        pricePerShare: 0.50,
        impliedProbabilityPercent: 50.0,
        availableLiquidityUsdc: 0,
        bestBid: null,
        bestAsk: null,
        totalDepthContracts: 0,
      };
    } catch (err) {
      console.warn('[TradeReviewService] Pricing fetch degraded to zero-liquidity model:', err);
      return {
        pricePerShare: 0.50,
        impliedProbabilityPercent: 50.0,
        availableLiquidityUsdc: 0,
        bestBid: null,
        bestAsk: null,
        totalDepthContracts: 0,
      };
    }
  }

  /**
   * Calculates trade payout, contracts received, and net profit for a given USDC trade amount.
   * In binary event contracts, 1 winning contract pays out 1.00 USDC.
   */
  public static calculateTrade(
    amountUsdc: number,
    pricing: MarketLivePricing
  ): TradeCalculationResult {
    const validAmount = isNaN(amountUsdc) || amountUsdc < 0 ? 0 : amountUsdc;
    const price = Math.max(0.001, pricing.pricePerShare);

    const estimatedContracts = validAmount > 0 ? validAmount / price : 0;
    const potentialPayoutUsdc = estimatedContracts * 1.0; // 1.00 USDC per winning share
    const netProfitUsdc = Math.max(0, potentialPayoutUsdc - validAmount);
    const returnMultiplier = validAmount > 0 ? potentialPayoutUsdc / validAmount : 0;
    const returnPercent = validAmount > 0 ? (netProfitUsdc / validAmount) * 100 : 0;
    const isLiquiditySufficient = validAmount <= (pricing.availableLiquidityUsdc || 10000);

    return {
      tradeAmountUsdc: Number(validAmount.toFixed(2)),
      pricePerShare: price,
      estimatedContracts: Number(estimatedContracts.toFixed(2)),
      potentialPayoutUsdc: Number(potentialPayoutUsdc.toFixed(2)),
      netProfitUsdc: Number(netProfitUsdc.toFixed(2)),
      returnMultiplier: Number(returnMultiplier.toFixed(2)),
      returnPercent: Number(returnPercent.toFixed(1)),
      availableLiquidityUsdc: pricing.availableLiquidityUsdc,
      isLiquiditySufficient,
    };
  }
}
