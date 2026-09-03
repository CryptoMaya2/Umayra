import { useState, useEffect, useCallback } from 'react';
import type { Address } from 'viem';
import { PositionTrackingService } from '../services/positionTrackingService';
import { RedemptionService, type RedemptionResult } from '../services/redemptionService';
import type { TrackedPosition } from '../types/position';

export function usePositions(userAddress: string | null) {
  const [positions, setPositions] = useState<TrackedPosition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [claimingPositionId, setClaimingPositionId] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<{ id: string; result: RedemptionResult } | null>(null);

  const refreshPositions = useCallback(async () => {
    if (!userAddress) {
      setPositions([]);
      return;
    }

    setIsLoading(true);
    try {
      const refreshed = await PositionTrackingService.refreshAllPositions(userAddress);
      setPositions(refreshed);
    } catch {
      // Degrade gracefully
    } finally {
      setIsLoading(false);
    }
  }, [userAddress]);

  // Initial load and periodic refresh
  useEffect(() => {
    if (!userAddress) {
      setPositions([]);
      return;
    }

    refreshPositions();

    const interval = setInterval(() => {
      refreshPositions();
    }, 12000); // refresh every 12 seconds

    return () => clearInterval(interval);
  }, [userAddress, refreshPositions]);

  const claimWinnings = async (position: TrackedPosition): Promise<RedemptionResult> => {
    if (!userAddress) {
      return {
        success: false,
        txHash: null,
        explorerUrl: null,
        claimedAmountUsdc: 0,
        statusMessage: 'Wallet not connected',
        error: 'Please connect your wallet.',
      };
    }

    setClaimingPositionId(position.id);
    setClaimResult(null);

    try {
      const res = await RedemptionService.claimWinnings(position, userAddress as Address);
      setClaimResult({ id: position.id, result: res });
      if (res.success) {
        refreshPositions();
      }
      return res;
    } finally {
      setClaimingPositionId(null);
    }
  };

  const activeCount = positions.filter((p) => p.status === 'ACTIVE').length;
  const claimableCount = positions.filter((p) => p.status === 'CLAIMABLE' || p.status === 'VOIDED').length;

  return {
    positions,
    isLoading,
    claimingPositionId,
    claimResult,
    activeCount,
    claimableCount,
    refreshPositions,
    claimWinnings,
  };
}
