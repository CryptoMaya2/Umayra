import type { IntentDirection } from './intent';

export type PositionStatus = 
  | 'ACTIVE'                  // Live trading, not yet expired
  | 'EXPIRED_SETTLING'        // Expired on-chain, awaiting oracle resolution
  | 'CLAIMABLE'               // Resolved on-chain & user won, winnings ready to claim
  | 'CLAIMED'                 // Winnings successfully claimed & verified on-chain
  | 'LOST'                    // Resolved on-chain, opposite direction won
  | 'VOIDED';                 // Voided on-chain, refund ready to claim

export interface TrackedPosition {
  id: string;                 // unique position id
  marketId: string;           // bytes32 marketId
  symbol: string;             // Event Contract symbol (e.g. ETH-2513.69-27AUG-1439/USDC)
  asset: string;              // "BTC" | "ETH"
  direction: IntentDirection; // "UP" | "DOWN"
  outcomeIdx: 0 | 1;          // 0 = YES / UP, 1 = NO / DOWN
  tradeAmountUsdc: number;    // Collateral paid in USDC
  sharesCount: number;        // Outcome contract tokens owned
  entryPrice: number;         // Execution price per share (e.g. 0.59)
  currentProbability?: number;// Implied probability from live book (if active)
  expiryTimestamp: number;    // Unix seconds
  expiryDateString: string;   // Human formatted expiry string
  strike: number;             // Oracle strike price
  txHash: string;             // Order placement tx hash
  userAddress: string;        // Connected wallet address
  createdAt: number;          // Timestamp created
  status: PositionStatus;     // Lifecycle status
  winningOutcome?: number | null; // 0 = YES, 1 = NO
  claimedAmountUsdc?: number; // Claimed payout in USDC
  claimTxHash?: string;       // Redemption tx hash
}
