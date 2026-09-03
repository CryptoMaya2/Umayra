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
      const tradableMarkets = await MarketDiscoveryService.discoverMarkets({
        asset: intent.asset,
        tradableOnly: true,
      }, 50);

      if (tradableMarkets.length === 0) {
        // Double check all discovered to see if any are in other lifecycle phases
        const allDiscovered = await MarketDiscoveryService.discoverMarkets({
          asset: intent.asset,
          tradableOnly: false,
        }, 10);

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

      // 2. Filter for markets with sufficient remaining trading window (at least 45s buffer)
      // This prevents matching series that expire while the user is reading or approving the transaction
      const MIN_EXECUTION_BUFFER_SEC = 45;
      const viableMarkets = tradableMarkets.filter(m => m.secondsRemaining >= MIN_EXECUTION_BUFFER_SEC);
      const candidatePool = viableMarkets.length > 0 ? viableMarkets : tradableMarkets;

      // 3. Rank candidate markets based on requested timeframe
      let matchedMarket: NormalizedEventMarket | null = null;
      let candidateMarkets: NormalizedEventMarket[] = [];

      if (intent.timeframeSec && intent.timeframeSec > 0) {
        // Sort by how close the market's remaining time is to the requested timeframe
        const sortedByTimeDelta = [...candidatePool].sort((a, b) => {
          const deltaA = Math.abs(a.secondsRemaining - (intent.timeframeSec || 0));
          const deltaB = Math.abs(b.secondsRemaining - (intent.timeframeSec || 0));
          return deltaA - deltaB;
        });

        matchedMarket = sortedByTimeDelta[0] || null;
        candidateMarkets = sortedByTimeDelta.slice(0, 3);
      } else {
        // Default to the active unexpired market with best remaining window
        const sortedByExpiry = [...candidatePool].sort((a, b) => a.expiry - b.expiry);
        matchedMarket = sortedByExpiry[0] || null;
        candidateMarkets = sortedByExpiry.slice(0, 3);
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
}
