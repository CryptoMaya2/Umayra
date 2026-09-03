import type { NormalizedEventMarket } from './market';

export type IntentAsset = 'BTC' | 'ETH';
export type IntentDirection = 'UP' | 'DOWN';
export type IntentAction = 'PREDICT' | 'PLACE_TRADE' | 'CLARIFY';

export interface SelectedMarketContext {
  market: NormalizedEventMarket;
  direction: IntentDirection;
  tradeAmount?: number | null;
}

export interface ParsedMarketIntent {
  rawText: string;
  action: IntentAction;
  asset: IntentAsset | null;
  direction: IntentDirection | null;
  timeframeSec: number | null;
  timeframeLabel: string | null;
  targetPrice?: number | null;
  tradeAmount?: number | null;
  isComplete: boolean;
  missingFields: ('asset' | 'direction' | 'timeframe' | 'tradeAmount')[];
  clarificationPrompt: string | null;
  unsupportedAsset?: string | null;
  selectedMarket?: NormalizedEventMarket | null;
}

export type MessageType = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  sender: MessageType;
  timestamp: Date;
  text: string;
  intent?: ParsedMarketIntent;
  matchedMarket?: NormalizedEventMarket | null;
  candidateMarkets?: NormalizedEventMarket[];
  status?: 'success' | 'clarification' | 'no_market_found' | 'error';
  initialTradeAmount?: number;
  initialReviewOpen?: boolean;
}

