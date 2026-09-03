import { createWalletClient, custom, type Address, type Hash, type TransactionReceipt } from 'viem';
import { somniaShannon } from '@somnia-chain/markets-sdk/chains';
import { somniaExchange, somniaClient } from '../lib/somniaClient';
import { WalletService, SOMNIA_SHANNON_CHAIN_ID } from './walletService';
import type { NormalizedEventMarket } from '../types/market';
import type { IntentDirection } from '../types/intent';

export interface OrderExecutionParams {
  market: NormalizedEventMarket;
  direction: IntentDirection;
  tradeAmountUsdc: number;
  userAddress: Address;
}

export interface OrderExecutionResult {
  success: boolean;
  txHash: Hash | null;
  explorerUrl: string | null;
  marketSymbol: string;
  asset: string;
  direction: IntentDirection;
  tradeAmountUsdc: number;
  executionPrice: number;
  sharesReceived: number;
  status: 'filled' | 'partially_filled' | 'cancelled' | 'failed';
  statusMessage: string;
  receipt?: TransactionReceipt;
  error?: string;
}

export class OrderExecutionService {
  /**
   * Executes a live DreamDEX Event Contract market order on Somnia Shannon Testnet.
   * Strictly requires explicit user confirmation before initiation.
   */
  public static async executeOrder(params: OrderExecutionParams): Promise<OrderExecutionResult> {
    const { market, direction, tradeAmountUsdc, userAddress } = params;

    // 1. Pre-flight Verification: Browser Wallet Check
    if (!WalletService.isWalletAvailable()) {
      return {
        success: false,
        txHash: null,
        explorerUrl: null,
        marketSymbol: market.symbol,
        asset: market.asset,
        direction,
        tradeAmountUsdc,
        executionPrice: 0,
        sharesReceived: 0,
        status: 'failed',
        statusMessage: 'No browser wallet detected',
        error: 'Please connect a compatible browser wallet (e.g. MetaMask, Rabby).',
      };
    }

    const ethereum = (window as any).ethereum;

    // 2. Pre-flight Verification: Network Check
    try {
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainIdHex, 16);
      if (currentChainId !== SOMNIA_SHANNON_CHAIN_ID) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          marketSymbol: market.symbol,
          asset: market.asset,
          direction,
          tradeAmountUsdc,
          executionPrice: 0,
          sharesReceived: 0,
          status: 'failed',
          statusMessage: 'Wrong Network',
          error: `Wallet is connected to Chain ID ${currentChainId}. Please switch to Somnia Shannon Testnet (${SOMNIA_SHANNON_CHAIN_ID}).`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        txHash: null,
        explorerUrl: null,
        marketSymbol: market.symbol,
        asset: market.asset,
        direction,
        tradeAmountUsdc,
        executionPrice: 0,
        sharesReceived: 0,
        status: 'failed',
        statusMessage: 'Network check failed',
        error: err?.message || 'Failed to verify active network.',
      };
    }

    // 3. Pre-flight Verification: Live On-Chain Status Gating
    try {
      const onchain = await somniaClient.getMarketOnchain(market.marketId as `0x${string}`);
      const nowSec = Math.floor(Date.now() / 1000);
      const isTimeActive = Number(onchain.expiry) > nowSec;

      if (onchain.status !== 1 || !isTimeActive) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          marketSymbol: market.symbol,
          asset: market.asset,
          direction,
          tradeAmountUsdc,
          executionPrice: 0,
          sharesReceived: 0,
          status: 'failed',
          statusMessage: 'Market not tradable',
          error: `Market status is code ${onchain.status} (expired: ${!isTimeActive}). Trades can only be submitted to actively trading series.`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        txHash: null,
        explorerUrl: null,
        marketSymbol: market.symbol,
        asset: market.asset,
        direction,
        tradeAmountUsdc,
        executionPrice: 0,
        sharesReceived: 0,
        status: 'failed',
        statusMessage: 'Failed to verify on-chain status',
        error: err?.message || 'Could not verify on-chain market status.',
      };
    }

    // 4. Pre-flight Verification: Balance Check
    try {
      const balances = await WalletService.fetchBalances(userAddress);
      const nativeBalanceFloat = parseFloat(balances.nativeBalance);
      const usdcBalanceFloat = parseFloat(balances.usdcBalance);

      if (nativeBalanceFloat <= 0) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          marketSymbol: market.symbol,
          asset: market.asset,
          direction,
          tradeAmountUsdc,
          executionPrice: 0,
          sharesReceived: 0,
          status: 'failed',
          statusMessage: 'Insufficient gas balance',
          error: 'Your wallet has 0 STT for gas fees on Somnia Shannon testnet.',
        };
      }

      if (usdcBalanceFloat < tradeAmountUsdc && usdcBalanceFloat > 0) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          marketSymbol: market.symbol,
          asset: market.asset,
          direction,
          tradeAmountUsdc,
          executionPrice: 0,
          sharesReceived: 0,
          status: 'failed',
          statusMessage: 'Insufficient collateral',
          error: `Insufficient testnet USDC balance (You have ${balances.usdcBalance}, trade requires $${tradeAmountUsdc.toFixed(2)} USDC).`,
        };
      }
    } catch {
      // Balance fetch notice
    }

    // 5. Load Unified Exchange Registry & Resolve Tradable Symbol
    try {
      if (Object.keys(somniaExchange.markets).length === 0) {
        await somniaExchange.loadMarkets();
      }

      const unifiedMarket = Object.values(somniaExchange.markets).find(
        (u) =>
          u.id.toLowerCase() === market.marketId.toLowerCase() ||
          u.symbol.toLowerCase().includes(market.shortMarketId.toLowerCase())
      );

      if (!unifiedMarket) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          marketSymbol: market.symbol,
          asset: market.asset,
          direction,
          tradeAmountUsdc,
          executionPrice: 0,
          sharesReceived: 0,
          status: 'failed',
          statusMessage: 'Market symbol lookup failed',
          error: 'Could not resolve exchange tradable symbol for this Event Contract.',
        };
      }

      const outcomeSuffix = direction === 'UP' ? '#YES' : '#NO';
      const tradableSymbol = `${unifiedMarket.symbol}${outcomeSuffix}`;

      // 6. Check Live Order Book Liquidity for specific direction
      const orderBook = await somniaExchange.fetchOrderBook(unifiedMarket.symbol);
      const hasAsks = orderBook.asks && orderBook.asks.length > 0;
      const hasBids = orderBook.bids && orderBook.bids.length > 0;

      const hasSideLiquidity = direction === 'UP' ? hasAsks : (hasBids || hasAsks);
      if (!hasSideLiquidity) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          marketSymbol: market.symbol,
          asset: market.asset,
          direction,
          tradeAmountUsdc,
          executionPrice: 0,
          sharesReceived: 0,
          status: 'failed',
          statusMessage: 'Insufficient Liquidity',
          error: `The live order book has no resting ${direction === 'UP' ? 'YES (Ask)' : 'NO (Bid)'} liquidity for this series. Please select an active series with resting orders.`,
        };
      }

      // Calculate approximate entry price
      const bestAsk = orderBook.asks[0] ? orderBook.asks[0][0] : 0.50;
      const bestBid = orderBook.bids[0] ? orderBook.bids[0][0] : 0.50;
      const estimatedPrice = direction === 'UP' ? bestAsk : (hasBids ? Number((1 - bestBid).toFixed(4)) : (1 - bestAsk));
      const targetPrice = Math.max(0.01, Math.min(0.99, estimatedPrice));

      // Calculate contracts to purchase and quantize
      const rawQuantity = tradeAmountUsdc / targetPrice;
      const quantizedQuantity = somniaExchange.amountToPrecision(tradableSymbol, rawQuantity);

      if (quantizedQuantity <= 0) {
        return {
          success: false,
          txHash: null,
          explorerUrl: null,
          marketSymbol: market.symbol,
          asset: market.asset,
          direction,
          tradeAmountUsdc,
          executionPrice: targetPrice,
          sharesReceived: 0,
          status: 'failed',
          statusMessage: 'Order amount below minimum lot size',
          error: 'The requested amount is below the minimum contract lot size for this pool.',
        };
      }

      // 7. Bind Browser Wallet Signer to SomniaMarkets
      const walletClient = createWalletClient({
        chain: somniaShannon,
        transport: custom(ethereum),
        account: userAddress,
      });

      somniaExchange.setSigner({
        walletClient,
        account: userAddress,
      });

      // 8. Broadcast Order via DreamDEX SDK (IOC execution)
      const order = await somniaExchange.createOrder(
        tradableSymbol,
        'market',
        'buy',
        quantizedQuantity,
        undefined,
        {
          timeInForce: 'IOC',
          slippage: 0.03, // 3% slippage protection
        }
      );

      const txHash = (order.txHash || (order.info as any)?.hash) as Hash;
      const explorerUrl = txHash ? `https://shannon-explorer.somnia.network/tx/${txHash}` : null;
      const fillPrice = order.price || targetPrice;
      const filledAmount = order.filled || quantizedQuantity;

      return {
        success: true,
        txHash,
        explorerUrl,
        marketSymbol: market.symbol,
        asset: market.asset,
        direction,
        tradeAmountUsdc,
        executionPrice: Number(fillPrice.toFixed(4)),
        sharesReceived: Number(filledAmount.toFixed(2)),
        status: order.status === 'open' ? 'partially_filled' : 'filled',
        statusMessage: 'Prediction placed successfully on Somnia Shannon testnet.',
      };
    } catch (err: any) {
      console.error('[OrderExecutionService] Execution error:', err);
      const isUserRejection = 
        err?.code === 4001 || 
        err?.message?.includes('User rejected') || 
        err?.message?.includes('denied');

      const isNoFill = 
        err?.message?.includes('ImmediateOrCancelNoFill') || 
        err?.message?.includes('immediate occurs to no fill') ||
        err?.shortMessage?.includes('ImmediateOrCancelNoFill');

      let errorDisplay = 'Transaction reverted or was rejected by the node.';
      if (isUserRejection) {
        errorDisplay = 'Wallet signature was cancelled by user.';
      } else if (isNoFill) {
        errorDisplay = 'Order unfilled: There is insufficient resting order book liquidity for this price limit.';
      } else if (err?.shortMessage || err?.message) {
        errorDisplay = err?.shortMessage || err?.message;
      }

      return {
        success: false,
        txHash: null,
        explorerUrl: null,
        marketSymbol: market.symbol,
        asset: market.asset,
        direction,
        tradeAmountUsdc,
        executionPrice: 0,
        sharesReceived: 0,
        status: 'failed',
        statusMessage: isUserRejection ? 'Signature Cancelled' : (isNoFill ? 'No Fill (Empty Book)' : 'Order Submission Failed'),
        error: errorDisplay,
      };
    }
  }
}
