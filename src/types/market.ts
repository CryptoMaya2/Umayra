import type { BinaryMarket, MarketOnchain } from '@somnia-chain/markets-sdk';

export type SupportedAsset = 'BTC' | 'ETH' | 'ALL';

export type MarketLifecycleStatus = 
  | 'Listed' 
  | 'Trading' 
  | 'Locked' 
  | 'Settling' 
  | 'Resolved' 
  | 'Voided' 
  | 'Unknown';

export interface OutcomeInfo {
  name: 'UP' | 'DOWN';
  label: string; // 'YES (Above Strike)' | 'NO (Below Strike)'
  tokenId: string;
  index: number;
}

export interface NormalizedEventMarket {
  /** bytes32 Hex ID representing the market */
  marketId: string;
  /** Shortened representation of market ID */
  shortMarketId: string;
  /** Underlying asset symbol (e.g., BTC, ETH) */
  asset: 'BTC' | 'ETH' | string;
  /** Synthesized market symbol (e.g. BTC-78735.37-25AUG26-2335/USDC) */
  symbol: string;
  /** Full oracle question description */
  question: string;
  /** Strike price in formatted decimal units (e.g., 78735.37) */
  strike: number;
  /** Raw strike price string from contract */
  strikeRaw: string;
  /** Series interval cadence in seconds (e.g., 60, 900) */
  intervalSec: number;
  /** Origin venue identifier (bytes32 hex) */
  venueId: string;
  /** Pool contract address */
  poolAddress: string;
  /** Binary market contract clone address */
  marketAddress: string;
  /** ERC-20 collateral address */
  collateralAddress: string;
  /** Trading start timestamp (seconds) */
  tradingStart: number;
  /** Expiry / settlement timestamp (seconds) */
  expiry: number;
  /** Human readable ISO string of expiry */
  expiryDateString: string;
  /** Outcome specifications for Up (YES) and Down (NO) */
  outcomes: {
    up: OutcomeInfo;
    down: OutcomeInfo;
  };
  /** Indexer reported status */
  indexerStatus: string;
  /** Live on-chain status code (0: Listed, 1: Trading, 2: Locked, 3: Settling, 4: Resolved, 5: Voided) */
  onchainStatusCode: number | null;
  /** Human friendly lifecycle status label */
  statusLabel: MarketLifecycleStatus;
  /** Strictly whether the market is currently open for trading (status is Trading AND not expired) */
  isTradable: boolean;
  /** Whether the market is expired based on current timestamp */
  isExpired: boolean;
  /** Approximate seconds remaining until expiry */
  secondsRemaining: number;
  /** Winning outcome if resolved (0 for UP/YES, 1 for DOWN/NO, null if pending) */
  winningOutcome: number | null;
  /** Resolution outcome label */
  winningLabel: 'UP' | 'DOWN' | 'PENDING' | 'VOID';
  /** Raw SDK market references */
  rawMarket: BinaryMarket;
  rawOnchain?: MarketOnchain;
}

export interface MarketDiscoveryFilter {
  asset?: SupportedAsset;
  tradableOnly?: boolean;
  search?: string;
  intervalSec?: number;
}

export interface MarketDiscoveryState {
  markets: NormalizedEventMarket[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  stats: {
    totalDiscovered: number;
    tradableCount: number;
    btcActiveCount: number;
    ethActiveCount: number;
  };
}
