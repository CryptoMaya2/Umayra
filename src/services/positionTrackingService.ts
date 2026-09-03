import { somniaClient, somniaExchange } from '../lib/somniaClient';
import type { TrackedPosition, PositionStatus } from '../types/position';

const STORAGE_PREFIX = 'umayra_positions_';
const memoryStore: Map<string, string> = new Map();

export class PositionTrackingService {
  /**
   * Retrieves all stored positions for a given user wallet address.
   */
  public static getStoredPositions(userAddress: string): TrackedPosition[] {
    if (!userAddress) return [];
    try {
      const key = `${STORAGE_PREFIX}${userAddress.toLowerCase()}`;
      let data: string | null = null;
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        data = localStorage.getItem(key);
      } else {
        data = memoryStore.get(key) || null;
      }
      if (!data) return [];
      return JSON.parse(data) as TrackedPosition[];
    } catch {
      return [];
    }
  }

  /**
   * Saves or prepends a new position to the user's stored positions.
   */
  public static savePosition(position: TrackedPosition): void {
    if (!position.userAddress) return;
    try {
      const key = `${STORAGE_PREFIX}${position.userAddress.toLowerCase()}`;
      const existing = this.getStoredPositions(position.userAddress);
      const filtered = existing.filter((p) => p.id !== position.id);
      const updated = [position, ...filtered];
      const serialized = JSON.stringify(updated);
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, serialized);
      } else {
        memoryStore.set(key, serialized);
      }
    } catch (err) {
      console.warn('[PositionTrackingService] Failed to save position:', err);
    }
  }

  /**
   * Updates an existing stored position.
   */
  public static updatePosition(position: TrackedPosition): void {
    this.savePosition(position);
  }

  /**
   * Refreshes real-time on-chain lifecycle status and live probabilities for a position.
   */
  public static async refreshPositionOnchain(position: TrackedPosition): Promise<TrackedPosition> {
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      let status: PositionStatus = position.status;
      let winningOutcome: number | null = position.winningOutcome ?? null;
      let currentProbability = position.currentProbability;

      // 1. Check live on-chain status from Somnia Shannon Testnet
      const onchain = await somniaClient.getMarketOnchain(position.marketId as `0x${string}`);
      const isTimeActive = Number(onchain.expiry) > nowSec;

      if (onchain.status === 1) {
        // Status 1: Trading
        if (isTimeActive) {
          status = 'ACTIVE';
          // Try updating live market probability
          try {
            if (Object.keys(somniaExchange.markets).length === 0) {
              await somniaExchange.loadMarkets();
            }
            const um = Object.values(somniaExchange.markets).find(
              (u) => u.id.toLowerCase() === position.marketId.toLowerCase()
            );
            if (um) {
              const ob = await somniaExchange.fetchOrderBook(um.symbol);
              if (position.direction === 'UP' && ob.asks[0]) {
                currentProbability = Math.round(ob.asks[0][0] * 100);
              } else if (position.direction === 'DOWN' && ob.bids[0]) {
                currentProbability = Math.round((1 - ob.bids[0][0]) * 100);
              }
            }
          } catch {
            // Ignore live book refresh errors
          }
        } else {
          status = 'EXPIRED_SETTLING';
        }
      } else if (onchain.status === 2 || onchain.status === 3) {
        // Status 2: Locked, Status 3: Settling
        status = 'EXPIRED_SETTLING';
      } else if (onchain.status === 4) {
        // Status 4: Resolved / Finalized
        winningOutcome = onchain.winningOutcome;
        if (position.status === 'CLAIMED') {
          status = 'CLAIMED';
        } else if (winningOutcome === position.outcomeIdx) {
          status = 'CLAIMABLE';
        } else {
          status = 'LOST';
        }
      } else if (onchain.status === 5) {
        // Status 5: Voided
        if (position.status === 'CLAIMED') {
          status = 'CLAIMED';
        } else {
          status = 'VOIDED';
        }
      }

      const updated: TrackedPosition = {
        ...position,
        status,
        winningOutcome,
        currentProbability,
      };

      this.updatePosition(updated);
      return updated;
    } catch (err) {
      console.warn(`[PositionTrackingService] On-chain check failed for ${position.symbol}:`, err);
      return position;
    }
  }

  /**
   * Refreshes all positions for a user address.
   */
  public static async refreshAllPositions(userAddress: string): Promise<TrackedPosition[]> {
    const positions = this.getStoredPositions(userAddress);
    if (positions.length === 0) return [];

    const refreshed = await Promise.all(
      positions.map((p) => this.refreshPositionOnchain(p))
    );
    return refreshed;
  }
}
