import { MarketDiscoveryService } from './marketDiscoveryService';
import type { ParsedMarketIntent } from '../types/intent';
import type { NormalizedEventMarket } from '../types/market';

export interface MarketMatchResult {
  matchedMarket: NormalizedEventMarket | null;
  candidateMarkets: NormalizedEventMarket[];
  summaryMessage: string;
  hasMatch: boolean;
}

export class MarketMatcherService {
  /**
   * Matches a structured market intention against verified live on-chain markets.
   */
  public static async matchIntent(intent: ParsedMarketIntent): Promise<MarketMatchResult> {
    if (!intent.asset) {
      return {
        matchedMarket: null,
        candidateMarkets: [],
        summaryMessage: intent.clarificationPrompt || 'Please specify an asset (BTC or ETH).',
        hasMatch: false,
      };
    }

    if (!intent.direction) {
      return {
        matchedMarket: null,
        candidateMarkets: [],
        summaryMessage: intent.clarificationPrompt || `Please specify whether you expect ${intent.asset} to go UP or DOWN.`,
        hasMatch: false,
      };
    }

    try {
      // 1. Fetch currently tradable unexpired markets for the requested asset
      const tradableResult = await MarketDiscoveryService.discoverMarkets({
        asset: intent.asset,
        tradableOnly: true,
      }, 50);
      const tradableMarkets = tradableResult.markets;

      if (tradableMarkets.length === 0) {
        // Double check all discovered to see if any are in other lifecycle phases
        const allResult = await MarketDiscoveryService.discoverMarkets({
          asset: intent.asset,
          tradableOnly: false,
        }, 10);
        const allDiscovered = allResult.markets;

        if (allDiscovered.length > 0) {
          return {
            matchedMarket: null,
            candidateMarkets: allDiscovered.slice(0, 3),
            summaryMessage: `No active, tradable ${intent.asset} series are open right now (all ${allDiscovered.length} discovered series are currently expired or settling). On Somnia testnet, new 60s/15m series deploy regularly.`,
            hasMatch: false,
          };
        }

        return {
          matchedMarket: null,
          candidateMarkets: [],
          summaryMessage: `No ${intent.asset} Event Contract markets were found on the Somnia Shannon testnet indexer.`,
          hasMatch: false,
        };
      }

      // 2. Filter for markets with sufficient remaining trading window.
      // If markets with at least 60s buffer exist, filter out ones expiring immediately (<60s).
      const MIN_PREFERRED_BUFFER_SEC = 60;
      const viableMarkets = tradableMarkets.filter(m => m.secondsRemaining >= MIN_PREFERRED_BUFFER_SEC);
      const candidatePool = viableMarkets.length > 0 ? viableMarkets : tradableMarkets;

      // 3. Rank candidate markets based on user intent and time remaining
      let matchedMarket: NormalizedEventMarket | null = null;
      let candidateMarkets: NormalizedEventMarket[] = [];

      if (intent.timeframeSec && intent.timeframeSec > 0) {
        // When timeframe is specified: prefer markets matching the requested duration tier,
        // and between comparable matches, prefer the one with more time remaining.
        const sorted = [...candidatePool].sort((a, b) => {
          const deltaA = Math.abs(a.secondsRemaining - (intent.timeframeSec || 0));
          const deltaB = Math.abs(b.secondsRemaining - (intent.timeframeSec || 0));
          // If both are within 5 minutes of each other in timeframe delta, prefer more time remaining
          if (Math.abs(deltaA - deltaB) <= 300) {
            return b.secondsRemaining - a.secondsRemaining;
          }
          return deltaA - deltaB;
        });

        matchedMarket = sorted[0] || null;
        candidateMarkets = sorted.slice(0, 3);
      } else {
        // When no specific timeframe is specified:
        // Prefer suitable live markets with more time remaining before expiry (avoid near-expiry traps),
        // filtering out ultra-long multi-week series if active intraday/daily series (<= 2 days) exist.
        const sensiblePool = candidatePool.filter(m => m.secondsRemaining <= 172800);
        const poolToUse = sensiblePool.length > 0 ? sensiblePool : candidatePool;

        const sortedByRemainingTime = [...poolToUse].sort((a, b) => {
          // Prefer market with more time remaining before expiry
          return b.secondsRemaining - a.secondsRemaining;
        });

        matchedMarket = sortedByRemainingTime[0] || null;
        candidateMarkets = sortedByRemainingTime.slice(0, 3);
      }

      if (!matchedMarket) {
        return {
          matchedMarket: null,
          candidateMarkets: [],
          summaryMessage: `No suitable ${intent.asset} ${intent.direction} market matching your timeframe could be matched.`,
          hasMatch: false,
        };
      }

      const outcomeLabel = intent.direction === 'UP' ? 'UP (YES)' : 'DOWN (NO)';
      const timeRemainingStr = matchedMarket.secondsRemaining < 60 
        ? `${matchedMarket.secondsRemaining}s` 
        : `${Math.round(matchedMarket.secondsRemaining / 60)}m`;

      const strikeDesc = matchedMarket.strike > 0 
        ? `with target strike **$${matchedMarket.strike.toLocaleString('en-US', { minimumFractionDigits: 2 })}**` 
        : `resolving against the **Series Open Reference Price**`;

      const summaryMessage = `I found a live, on-chain **${intent.asset}** Event Contract matching your **${outcomeLabel}** prediction ${strikeDesc} (expires in ~${timeRemainingStr}).`;

      return {
        matchedMarket,
        candidateMarkets,
        summaryMessage,
        hasMatch: true,
      };
    } catch (err: any) {
      console.error('[MarketMatcherService] Error during market match:', err);
      return {
        matchedMarket: null,
        candidateMarkets: [],
        summaryMessage: `Failed to query testnet markets: ${err?.message || err}`,
        hasMatch: false,
      };
    }
  }

  /**
   * Re-resolves an active user intent against current live markets when the previous market has expired.
   * Finds the best live tradable successor market for the given asset and direction.
   */
  public static async findSuccessorMarket(
    asset: 'BTC' | 'ETH',
    direction: 'UP' | 'DOWN',
    expiredMarketId?: string
  ): Promise<NormalizedEventMarket | null> {
    const res = await this.matchIntent({
      rawText: `Live ${asset} ${direction} market`,
      action: 'PREDICT',
      asset,
      direction,
      timeframeSec: null,
      timeframeLabel: null,
      isComplete: true,
      missingFields: [],
      clarificationPrompt: null,
    });

    if (res.hasMatch && res.matchedMarket) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (expiredMarketId && res.matchedMarket.marketId === expiredMarketId) {
        const next = res.candidateMarkets.find(
          m => m.marketId !== expiredMarketId && m.isTradable && m.expiry > nowSec
        );
        return next || null;
      }
      // Ensure the returned market is not expired
      if (res.matchedMarket.expiry > nowSec && res.matchedMarket.isTradable) {
        return res.matchedMarket;
      }
    }
    return null;
  }
}
