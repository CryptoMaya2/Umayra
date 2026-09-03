import { createWalletClient, custom, parseUnits, type Address, type Hash, type Hex, type TransactionReceipt } from 'viem';
import { somniaShannon } from '@somnia-chain/markets-sdk/chains';
import { somniaExchange, somniaClient } from '../lib/somniaClient';
import { WalletService, SOMNIA_SHANNON_CHAIN_ID } from './walletService';
import { PositionTrackingService } from './positionTrackingService';
import type { TrackedPosition } from '../types/position';

export interface RedemptionResult {
  success: boolean;
  txHash: Hash | null;
  explorerUrl: string | null;
  claimedAmountUsdc: number;
  statusMessage: string;
  receipt?: TransactionReceipt;
  error?: string;
}

export class RedemptionService {
  /**
   * Redeems / claims winning outcome tokens for a settled Event Contract on Somnia Shannon Testnet.
   * Requires explicit user action before signature request.
   */
  public static async claimWinnings(
    position: TrackedPosition,
    userAddress: Address
  ): Promise<RedemptionResult> {
    // 1. Pre-flight Verification: Browser Wallet Check
    if (!WalletService.isWalletAvailable()) {
      return {
        success: false,
        txHash: null,
        explorerUrl: null,
        claimedAmountUsdc: 0,
        statusMessage: 'Wallet unavailable',
        error: 'No browser wallet detected. Please connect MetaMask or Rabby.',
      };
    }

    const ethereum = (window as any).ethereum;

    // 2. Pre-flight Verification: Shannon Testnet Network Check
    try {
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainIdHex, 16);
      if (currentChainId !== SOMNIA_SHANNON_CHAIN_ID) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          claimedAmountUsdc: 0,
          statusMessage: 'Wrong Network',
          error: `Wallet is connected to Chain ID ${currentChainId}. Please switch to Somnia Shannon Testnet (${SOMNIA_SHANNON_CHAIN_ID}).`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        txHash: null,
        explorerUrl: null,
        claimedAmountUsdc: 0,
        statusMessage: 'Network check failed',
        error: err?.message || 'Could not verify active network.',
      };
    }

    // 3. Pre-flight Verification: On-chain Market Resolution State
    try {
      const onchain = await somniaClient.getMarketOnchain(position.marketId as Hex);
      if (onchain.status !== 4 && onchain.status !== 5) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          claimedAmountUsdc: 0,
          statusMessage: 'Market not yet resolved',
          error: `Market status is code ${onchain.status}. Winnings can only be claimed once the market is Resolved on-chain.`,
        };
      }

      if (onchain.status === 4 && onchain.winningOutcome !== position.outcomeIdx) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          claimedAmountUsdc: 0,
          statusMessage: 'Position not winning',
          error: `Market resolved to outcome ${onchain.winningOutcome}, but position is ${position.outcomeIdx}.`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        txHash: null,
        explorerUrl: null,
        claimedAmountUsdc: 0,
        statusMessage: 'On-chain verification error',
        error: err?.message || 'Failed to verify on-chain market resolution.',
      };
    }

    // 4. Check if already claimed
    if (position.status === 'CLAIMED') {
      return {
        success: true,
        txHash: (position.claimTxHash as Hash) || null,
        explorerUrl: position.claimTxHash ? `https://shannon-explorer.somnia.network/tx/${position.claimTxHash}` : null,
        claimedAmountUsdc: position.claimedAmountUsdc || position.sharesCount,
        statusMessage: 'Already claimed',
      };
    }

    // 5. Setup Signer & Execute On-chain Redemption
    try {
      const walletClient = createWalletClient({
        chain: somniaShannon,
        transport: custom(ethereum),
        account: userAddress,
      });

      somniaExchange.setSigner({
        walletClient,
        account: userAddress,
      });

      // Amount in raw units (6 decimals for TestUSDC / outcome tokens)
      const rawAmount = parseUnits(position.sharesCount.toString(), 6);

      const txResult = await somniaExchange.trader.redeem({
        marketId: position.marketId as Hex,
        outcomeIdx: position.outcomeIdx,
        amount: rawAmount,
        autoApprove: true,
      });

      const txHash = txResult.hash;
      const explorerUrl = `https://shannon-explorer.somnia.network/tx/${txHash}`;
      const claimedAmountUsdc = position.sharesCount * 1.00;

      // 6. Update Stored Position State
      const updatedPosition: TrackedPosition = {
        ...position,
        status: 'CLAIMED',
        claimedAmountUsdc,
        claimTxHash: txHash,
      };
      PositionTrackingService.updatePosition(updatedPosition);

      return {
        success: true,
        txHash,
        explorerUrl,
        claimedAmountUsdc,
        statusMessage: 'Winnings claimed successfully!',
        receipt: txResult.receipt,
      };
    } catch (err: any) {
      console.error('[RedemptionService] Claim error:', err);
      const isUserRejection = 
        err?.code === 4001 || 
        err?.message?.includes('User rejected') || 
        err?.message?.includes('denied');

      return {
        success: false,
        txHash: null,
        explorerUrl: null,
        claimedAmountUsdc: 0,
        statusMessage: isUserRejection ? 'Signature Cancelled' : 'Claim Transaction Failed',
        error: isUserRejection 
          ? 'Wallet signature was cancelled by user.' 
          : err?.shortMessage || err?.message || 'Transaction reverted or was rejected by node.',
      };
    }
  }
}
