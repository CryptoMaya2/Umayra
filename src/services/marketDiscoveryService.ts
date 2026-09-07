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

/* ── Retry + Cache Infrastructure ────────────────────────────── */

/** Maximum number of attempts (1 initial + retries) */
const MAX_ATTEMPTS = 3;

/** Delay schedule between retries in ms (index 0 = delay before 2nd attempt, etc.) */
const RETRY_DELAYS_MS = [1000, 3000];


/** Result wrapper that carries a staleness flag alongside markets */
export interface DiscoveryResult {
  markets: NormalizedEventMarket[];
  /** True when the data was served from cache because the live indexer was unreachable */
  isStale: boolean;
  /** ISO timestamp of when the data was originally fetched */
  fetchedAt: string;
}

interface CacheEntry {
  markets: NormalizedEventMarket[];
  fetchedAt: number; // Date.now() when the live fetch succeeded
}

/** Simple in-memory cache keyed by a deterministic hash of the query parameters */
const discoveryCache: Map<string, CacheEntry> = new Map();

/** Builds a stable string key for a given filter + limit combination */
function cacheKey(filter: MarketDiscoveryFilter, limit: number): string {
  return `${filter.asset || 'ALL'}|${filter.tradableOnly ? '1' : '0'}|${filter.search || ''}|${limit}`;
}

/** Returns a promise that resolves after `ms` milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes `fn` with up to `MAX_ATTEMPTS` tries, waiting `RETRY_DELAYS_MS[i]` between
 * attempt i and attempt i+1. Returns the first successful result or throws the last error.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isLastAttempt = attempt >= MAX_ATTEMPTS - 1;
      if (isLastAttempt) break;

      const delayMs = RETRY_DELAYS_MS[attempt] || 3000;
      console.warn(
        `[MarketDiscoveryService] ${label} attempt ${attempt + 1}/${MAX_ATTEMPTS} failed` +
        ` (${err?.message || err}). Retrying in ${delayMs}ms…`
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

/* ── Strike Price Formatting ─────────────────────────────────── */

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
 * Primary Market Discovery Service: Queries Somnia Shannon indexer + chain on-chain checks.
 * All public query methods include automatic retry with exponential backoff and
 * in-memory cache fallback so that transient indexer outages never produce an empty screen.
 */
export class MarketDiscoveryService {
  /**
   * Discovers and normalizes all available binary event markets matching filters.
   * Retries up to 3 times on network failure (1s, 3s backoff).
   * On total failure, returns cached results (marked isStale) if available.
   */
  public static async discoverMarkets(
    filter: MarketDiscoveryFilter = {}, 
    limit = 60
  ): Promise<DiscoveryResult> {
    const key = cacheKey(filter, limit);

    try {
      const markets = await withRetry(
        () => this._fetchAndNormalize(filter, limit),
        'discoverMarkets'
      );

      // Cache the successful result
      const now = Date.now();
      discoveryCache.set(key, { markets, fetchedAt: now });

      return {
        markets,
        isStale: false,
        fetchedAt: new Date(now).toISOString(),
      };
    } catch (error: any) {
      console.error(
        `[MarketDiscoveryService] All ${MAX_ATTEMPTS} attempts failed for discoverMarkets:`,
        error?.message || error
      );

      // Attempt to serve from cache
      const cached = discoveryCache.get(key);
      if (cached && cached.markets.length > 0) {
        const ageMs = Date.now() - cached.fetchedAt;
        const ageSec = Math.round(ageMs / 1000);
        console.warn(
          `[MarketDiscoveryService] Serving ${cached.markets.length} cached markets` +
          ` (${ageSec}s old) after indexer failure.`
        );

        // Re-calculate secondsRemaining for cached markets against current time
        const nowSec = Math.floor(Date.now() / 1000);
        const refreshedMarkets = cached.markets.map(m => ({
          ...m,
          secondsRemaining: Math.max(0, m.expiry - nowSec),
          isExpired: m.expiry <= nowSec,
          // Conservatively mark expired-during-cache markets as not tradable
          isTradable: m.isTradable && m.expiry > nowSec,
        }));

        return {
          markets: refreshedMarkets,
          isStale: true,
          fetchedAt: new Date(cached.fetchedAt).toISOString(),
        };
      }

      // No cache available — propagate error
      throw new Error(
        `Failed to discover markets from Somnia Shannon testnet (${MAX_ATTEMPTS} attempts exhausted, no cache available): ${error?.message || error}`
      );
    }
  }

  /**
   * Internal: performs the actual indexer fetch + on-chain verification (no retry, no cache).
   */
  private static async _fetchAndNormalize(
    filter: MarketDiscoveryFilter,
    limit: number
  ): Promise<NormalizedEventMarket[]> {
    // 1. Fetch binary markets from indexer
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
  }

  /**
   * High-level helper to get currently active & tradable BTC and ETH binary markets.
   */
  public static async getActiveTradableMarkets(asset?: 'BTC' | 'ETH'): Promise<DiscoveryResult> {
    return this.discoverMarkets({
      asset: asset || 'ALL',
      tradableOnly: true
    }, 40);
  }

  /**
   * Fetches and verifies single market by ID.
   * Uses retry but no cache (point lookups are always fresh).
   */
  public static async getMarketById(marketId: string): Promise<NormalizedEventMarket | null> {
    try {
      const rawMarket = await withRetry(
        () => somniaClient.getBinaryMarket(marketId),
        `getMarketById(${marketId.slice(0, 10)})`
      );
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

  /**
   * Returns cache freshness information for diagnostics.
   */
  public static getCacheInfo(): { entries: number; keys: string[] } {
    return {
      entries: discoveryCache.size,
      keys: Array.from(discoveryCache.keys()),
    };
  }
}
