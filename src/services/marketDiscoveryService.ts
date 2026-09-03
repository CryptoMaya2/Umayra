import type { BinaryMarket, MarketOnchain } from '@somnia-chain/markets-sdk';
import { somniaClient } from '../lib/somniaClient';
import type { 
  NormalizedEventMarket, 
  MarketDiscoveryFilter, 
  MarketLifecycleStatus 
} from '../types/market';

const ONCHAIN_STATUS_MAP: Record<number, MarketLifecycleStatus> = {
  0: 'Listed',
  1: 'Trading',
  2: 'Locked',
  3: 'Settling',
  4: 'Resolved',
  5: 'Voided'
};

/**
 * Formats a raw integer strike price string into a human readable float.
 * Standard Oracle v2 strike feeds for BTC/ETH are scaled by 10^2 (cents/2 decimal places).
 */
export function formatStrikePrice(rawStrike: string | number, asset: string): number {
  const num = typeof rawStrike === 'number' ? rawStrike : parseFloat(rawStrike || '0');
  if (isNaN(num) || num === 0) return 0;

  // If strike is already in realistic float range (e.g., 78000 for BTC, 2500 for ETH)
  if (asset.toUpperCase() === 'BTC' && num < 500000 && num > 10000) {
    return num;
  }
  if (asset.toUpperCase() === 'ETH' && num < 20000 && num > 500) {
    return num;
  }

  // Standard 2-decimal oracle scaling (e.g., 7873537 -> 78735.37, 245113 -> 2451.13)
  if (num > 100000) {
    return +(num / 100).toFixed(2);
  }
  
  return num;
}

/**
 * Normalizes raw SDK BinaryMarket and optional MarketOnchain data into standard app model.
 */
export function normalizeMarket(
  market: BinaryMarket, 
  onchain?: MarketOnchain, 
  nowSec: number = Math.floor(Date.now() / 1000)
): NormalizedEventMarket {
  const marketId = market.marketId || market.id;
  const shortMarketId = marketId.startsWith('0x') 
    ? `${marketId.slice(0, 6)}...${marketId.slice(-4)}` 
    : marketId.slice(0, 10);

  const asset = (market.asset || 'UNKNOWN').toUpperCase();
  const strike = formatStrikePrice(market.strike, asset);
  const tradingStart = parseInt(market.tradingStart || '0', 10);
  const expiry = parseInt(market.expiry || '0', 10);
  const isExpired = expiry <= nowSec;
  const secondsRemaining = Math.max(0, expiry - nowSec);

  // Derive on-chain status
  const onchainStatusCode = onchain ? onchain.status : null;
  let statusLabel: MarketLifecycleStatus = 'Unknown';
  if (onchainStatusCode !== null && ONCHAIN_STATUS_MAP[onchainStatusCode]) {
    statusLabel = ONCHAIN_STATUS_MAP[onchainStatusCode];
  } else if (market.status) {
    statusLabel = (market.status as MarketLifecycleStatus) || 'Unknown';
  }

  // Derive tradability strictly
  // A market is tradable ONLY if status is 'Trading' (Code 1), not expired, and not resolved/voided
  const isStatusTrading = onchainStatusCode !== null 
    ? onchainStatusCode === 1 
    : market.status?.toLowerCase() === 'trading';

  const isResolved = onchain ? onchain.isResolved : (market.winningOutcome !== null && market.winningOutcome !== undefined);
  const isVoided = onchain ? onchain.isVoided : market.status?.toLowerCase() === 'voided';
  const isTradable = isStatusTrading && !isExpired && !isResolved && !isVoided;

  // Resolve winning outcome label
  let winningOutcome: number | null = null;
  let winningLabel: 'UP' | 'DOWN' | 'PENDING' | 'VOID' = 'PENDING';
  if (isVoided) {
    winningLabel = 'VOID';
  } else if (onchain?.isResolved) {
    winningOutcome = onchain.winningOutcome;
    winningLabel = winningOutcome === 0 ? 'UP' : 'DOWN';
  } else if (market.winningOutcome !== null && market.winningOutcome !== undefined) {
    winningOutcome = market.winningOutcome;
    winningLabel = winningOutcome === 0 ? 'UP' : 'DOWN';
  }

  // Generate clean readable symbol
  const expiryDate = new Date(expiry * 1000);
  const dateTag = `${expiryDate.getUTCDate()}${expiryDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()}`;
  const timeTag = `${String(expiryDate.getUTCHours()).padStart(2, '0')}${String(expiryDate.getUTCMinutes()).padStart(2, '0')}`;
  const symbol = `${asset}-${strike}-${dateTag}-${timeTag}/USDC`;

  return {
    marketId,
    shortMarketId,
    asset,
    symbol,
    question: market.question || `${asset} Up/Down Event Contract at $${strike}`,
    strike,
    strikeRaw: market.strike || '0',
    intervalSec: (market as any).intervalSec || 60,
    venueId: (market as any).venueId || '0x0',
    poolAddress: market.poolAddress || '',
    marketAddress: market.marketAddress || '',
    collateralAddress: market.collateral || '',
    tradingStart,
    expiry,
    expiryDateString: expiryDate.toUTCString(),
    outcomes: {
      up: {
        name: 'UP',
        label: 'YES (Above Strike)',
        tokenId: market.yesTokenId || '0',
        index: 0,
      },
      down: {
        name: 'DOWN',
        label: 'NO (Below Strike)',
        tokenId: market.noTokenId || '1',
        index: 1,
      }
    },
    indexerStatus: market.status || 'Unknown',
    onchainStatusCode,
    statusLabel,
    isTradable,
    isExpired,
    secondsRemaining,
    winningOutcome,
    winningLabel,
    rawMarket: market,
    rawOnchain: onchain,
  };
}

/**
 * Primary Market Discovery Service: Queries Somnia Shannon indexer + chain on-chain checks
 */
export class MarketDiscoveryService {
  /**
   * Discovers and normalizes all available binary event markets matching filters.
   */
  public static async discoverMarkets(
    filter: MarketDiscoveryFilter = {}, 
    limit = 60
  ): Promise<NormalizedEventMarket[]> {
    try {
      // 1. Fetch binary markets from indexer (use listLiveBinaryMarkets when looking for active series)
      const queryFilter: any = { limit };
      if (filter.asset && filter.asset !== 'ALL') {
        queryFilter.asset = filter.asset;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const rawMarkets = filter.tradableOnly 
        ? await somniaClient.listLiveBinaryMarkets({ ...queryFilter, nowSec })
        : await somniaClient.listBinaryMarkets(queryFilter);

      // 2. Perform concurrent on-chain status checks
      const normalizedList = await Promise.all(
        rawMarkets.map(async (rawMarket) => {
          let onchain: MarketOnchain | undefined;
          try {
            if (rawMarket.marketId) {
              onchain = await somniaClient.getMarketOnchain(rawMarket.marketId as `0x${string}`);
            }
          } catch {
            // Degrades gracefully if onchain call is throttled or point read fails
          }
          return normalizeMarket(rawMarket, onchain, nowSec);
        })
      );

      // 3. Apply client-side filters
      let result = normalizedList;

      if (filter.asset && filter.asset !== 'ALL') {
        result = result.filter(m => m.asset.toUpperCase() === filter.asset);
      }

      if (filter.tradableOnly) {
        result = result.filter(m => m.isTradable);
      }

      if (filter.search) {
        const needle = filter.search.toLowerCase();
        result = result.filter(m => 
          m.symbol.toLowerCase().includes(needle) || 
          m.question.toLowerCase().includes(needle) || 
          m.marketId.toLowerCase().includes(needle)
        );
      }

      // Sort: Active tradable first, then soonest expiry first
      result.sort((a, b) => {
        if (a.isTradable && !b.isTradable) return -1;
        if (!a.isTradable && b.isTradable) return 1;
        return a.expiry - b.expiry;
      });

      return result;
    } catch (error: any) {
      console.error('[MarketDiscoveryService] Failed to discover markets:', error);
      throw new Error(`Failed to discover markets from Somnia Shannon testnet: ${error?.message || error}`);
    }
  }

  /**
   * High-level helper to get currently active & tradable BTC and ETH binary markets.
   */
  public static async getActiveTradableMarkets(asset?: 'BTC' | 'ETH'): Promise<NormalizedEventMarket[]> {
    return this.discoverMarkets({
      asset: asset || 'ALL',
      tradableOnly: true
    }, 40);
  }

  /**
   * Fetches and verifies single market by ID
   */
  public static async getMarketById(marketId: string): Promise<NormalizedEventMarket | null> {
    try {
      const rawMarket = await somniaClient.getBinaryMarket(marketId);
      if (!rawMarket) return null;

      let onchain: MarketOnchain | undefined;
      try {
        onchain = await somniaClient.getMarketOnchain(marketId as `0x${string}`);
      } catch {
        // Fallback
      }

      return normalizeMarket(rawMarket, onchain);
    } catch (err) {
      console.error(`[MarketDiscoveryService] Error getting market ${marketId}:`, err);
      return null;
    }
  }
}
