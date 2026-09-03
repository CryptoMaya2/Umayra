import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  ShieldCheck, 
  TrendingUp, 
  Wallet, 
  CheckCircle2, 
  Info, 
  Layers, 
  ChevronRight, 
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  Loader2
} from 'lucide-react';
import type { NormalizedEventMarket } from '../types/market';
import type { IntentDirection } from '../types/intent';
import { TradeReviewService, type MarketLivePricing, type TradeCalculationResult } from '../services/tradeReviewService';
import { useWalletContext } from '../context/WalletContext';
import { OrderExecutionService, type OrderExecutionResult } from '../services/orderExecutionService';
import { PositionTrackingService } from '../services/positionTrackingService';

interface TradeReviewCardProps {
  market: NormalizedEventMarket;
  direction: IntentDirection;
  initialAmount?: number;
  initialOpenReview?: boolean;
  onResetChat?: () => void;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export const TradeReviewCard: React.FC<TradeReviewCardProps> = ({
  market,
  direction,
  initialAmount = 10,
  initialOpenReview = false,
  onResetChat,
}) => {
  const wallet = useWalletContext();
  const [tradeAmount, setTradeAmount] = useState<number>(initialAmount);
  const [pricing, setPricing] = useState<MarketLivePricing | null>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState<boolean>(true);
  
  // Workflow step state
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(initialOpenReview);
  const [isTradeConfirmed, setIsTradeConfirmed] = useState<boolean>(false);
  const [isReadyForConfirmation, setIsReadyForConfirmation] = useState<boolean>(false);

  useEffect(() => {
    if (initialAmount && initialAmount > 0) {
      setTradeAmount(initialAmount);
    }
    if (initialOpenReview) {
      setIsReviewOpen(true);
    }
  }, [initialAmount, initialOpenReview]);
  
  // Execution state
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<OrderExecutionResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingPricing(true);

    TradeReviewService.getLivePricing(market, direction)
      .then((res) => {
        if (isMounted) {
          setPricing(res);
          setIsLoadingPricing(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingPricing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [market, direction]);

  // Live real-time clock to prevent trading expired series
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isCurrentlyExpired = market.expiry <= nowSec;
  const currentSecondsRemaining = Math.max(0, market.expiry - nowSec);

  const activePricing: MarketLivePricing = pricing || {
    pricePerShare: 0.50,
    impliedProbabilityPercent: 50.0,
    availableLiquidityUsdc: 0,
    bestBid: null,
    bestAsk: null,
    totalDepthContracts: 0,
  };

  const tradeCalc: TradeCalculationResult = TradeReviewService.calculateTrade(
    tradeAmount,
    activePricing
  );

  const isUp = direction === 'UP';
  const outcomeLabel = isUp ? 'UP (YES)' : 'DOWN (NO)';
  const tokenSnippet = isUp ? market.outcomes.up.tokenId.slice(0, 10) : market.outcomes.down.tokenId.slice(0, 10);

  const strikeDisplay = market.strike > 0 
    ? `$${market.strike.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
    : 'Open Reference Price';

  const timeRemainingStr = currentSecondsRemaining <= 0 
    ? 'Expired' 
    : currentSecondsRemaining < 60 
      ? `${currentSecondsRemaining}s` 
      : `${Math.round(currentSecondsRemaining / 60)}m`;

  /**
   * Final explicit trade confirmation handler.
   * Only triggered when the user explicitly clicks "Confirm trade" on the final confirmation screen.
   */
  const handleFinalConfirmTrade = async () => {
    if (!wallet.address) {
      await wallet.connect();
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await OrderExecutionService.executeOrder({
        market,
        direction,
        tradeAmountUsdc: tradeAmount,
        userAddress: wallet.address,
      });

      setExecutionResult(result);
      if (result.success) {
        wallet.refreshBalances(wallet.address);

        // Track the position in user's active prediction portfolio
        PositionTrackingService.savePosition({
          id: `${market.marketId}_${direction}_${Date.now()}`,
          marketId: market.marketId,
          symbol: market.symbol,
          asset: market.asset,
          direction,
          outcomeIdx: direction === 'UP' ? 0 : 1,
          tradeAmountUsdc: tradeAmount,
          sharesCount: result.sharesReceived || tradeCalc.estimatedContracts,
          entryPrice: result.executionPrice || activePricing.pricePerShare,
          currentProbability: activePricing.impliedProbabilityPercent,
          expiryTimestamp: market.rawOnchain?.expiry ? Number(market.rawOnchain.expiry) : Math.floor(Date.now() / 1000) + market.secondsRemaining,
          expiryDateString: market.expiryDateString,
          strike: market.strike,
          txHash: result.txHash || '',
          userAddress: wallet.address,
          createdAt: Date.now(),
          status: 'ACTIVE',
        });
      }
    } catch (err: any) {
      setExecutionResult({
        success: false,
        txHash: null,
        explorerUrl: null,
        marketSymbol: market.symbol,
        asset: market.asset,
        direction,
        tradeAmountUsdc: tradeAmount,
        executionPrice: 0,
        sharesReceived: 0,
        status: 'failed',
        statusMessage: 'Execution failed',
        error: err?.message || 'An unexpected error occurred during trade execution.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="trade-review-container">
      {/* 1. Header Overview Bar */}
      <div className="trade-review-header">
        <div className="trade-review-header-left">
          <span className={`asset-color-dot ${market.asset.toLowerCase()}`} aria-hidden="true" />
          <strong>{market.asset} Event Contract</strong>
          <span className="trade-review-symbol">({market.symbol})</span>
        </div>
        <span className="match-live-pill">
          <span className="match-live-dot" />
          LIVE TESTNET
        </span>
      </div>

      {/* 2. Core Prediction Summary */}
      <div className="trade-review-summary">
        <div className="summary-section-label">YOUR PREDICTION</div>
        <div className="summary-headline-row">
          <div className={`summary-direction-badge ${isUp ? 'up' : 'down'}`}>
            {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            <span>{market.asset} will close {isUp ? 'ABOVE' : 'BELOW'} strike</span>
          </div>
          <div className="summary-probability-badge">
            <TrendingUp size={13} />
            <span>{isLoadingPricing ? 'Calculating...' : `${activePricing.impliedProbabilityPercent}% Implied Probability`}</span>
          </div>
        </div>

        <div className="summary-details-grid">
          <div className="detail-item">
            <span className="detail-label">Target Strike</span>
            <span className="detail-value text-serif">{strikeDisplay}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Share Price</span>
            <span className="detail-value font-mono">
              ${activePricing.pricePerShare.toFixed(2)} USDC / share
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Expiry Cadence</span>
            <span className="detail-value font-mono">
              ~{timeRemainingStr} ({market.expiryDateString.slice(0, 22)})
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Available Liquidity</span>
            <span className="detail-value font-mono">
              ${activePricing.availableLiquidityUsdc.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
            </span>
          </div>
        </div>
      </div>

      {/* 3. Review Prediction Trigger Button */}
      {!isReviewOpen && !isTradeConfirmed && !isReadyForConfirmation && !executionResult && (
        <div className="review-action-banner">
          <button 
            className="btn-review-prediction"
            onClick={() => setIsReviewOpen(true)}
            id="review-prediction-btn"
          >
            <span>Review prediction & position</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* 4. Interactive Trade Calculator (Position Configuration) */}
      {isReviewOpen && !isTradeConfirmed && !isReadyForConfirmation && !executionResult && (
        <div className="trade-calculator-pane">
          <div className="calculator-header">
            <div className="calculator-title">
              <Layers size={14} />
              <span>POSITION CALCULATOR</span>
            </div>
            <span className="calculator-rate">
              1 Winning Contract = 1.00 USDC Payout
            </span>
          </div>

          {/* Amount input & preset buttons */}
          <div className="amount-input-group">
            <label htmlFor="trade-amount-input" className="amount-label">
              How much USDC do you want to put in?
            </label>
            <div className="amount-input-wrapper">
              <span className="currency-prefix">$</span>
              <input
                id="trade-amount-input"
                type="number"
                min="1"
                step="1"
                className="amount-input"
                value={tradeAmount === 0 ? '' : tradeAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTradeAmount(isNaN(val) ? 0 : Math.max(0, val));
                }}
                placeholder="Enter amount (USDC)"
              />
              <span className="currency-suffix">USDC</span>
            </div>

            <div className="preset-chips-row">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`preset-chip ${tradeAmount === amt ? 'selected' : ''}`}
                  onClick={() => setTradeAmount(amt)}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Calculated Output Matrix */}
          <div className="payout-matrix">
            <div className="payout-matrix-row">
              <span className="matrix-label">Estimated Shares Received:</span>
              <span className="matrix-value font-mono">
                {tradeCalc.estimatedContracts.toLocaleString('en-US', { minimumFractionDigits: 2 })} {outcomeLabel} shares
              </span>
            </div>
            <div className="payout-matrix-row highlight">
              <span className="matrix-label">Potential Payout If Correct:</span>
              <span className="matrix-value font-mono text-up">
                ${tradeCalc.potentialPayoutUsdc.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
              </span>
            </div>
            <div className="payout-matrix-row">
              <span className="matrix-label">Potential Net Profit:</span>
              <span className="matrix-value font-mono text-up">
                +${tradeCalc.netProfitUsdc.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC (+{tradeCalc.returnPercent}%)
              </span>
            </div>
          </div>

          {/* What happens explanation */}
          <div className="trade-explanation-box">
            <Info size={13} className="info-icon" />
            <div className="explanation-text">
              If {market.asset} resolves <strong>{isUp ? 'above' : 'below'} {strikeDisplay}</strong> at {market.expiryDateString.slice(17, 22)} UTC, each share pays out <strong>$1.00 USDC</strong>. If not, the position settles at $0.00.
            </div>
          </div>

          {/* Expiry Alert if expired during review */}
          {isCurrentlyExpired && (
            <div className="wallet-error-box" role="alert" style={{ marginBottom: '12px' }}>
              <AlertTriangle size={15} />
              <span>This series has expired ({market.expiryDateString.slice(0, 22)}). Please return to chat to select an active series.</span>
            </div>
          )}

          {/* Confirm Action Button */}
          <div className="calculator-actions">
            <button
              className="btn-confirm-trade"
              onClick={() => setIsTradeConfirmed(true)}
              disabled={tradeAmount <= 0 || isCurrentlyExpired}
              id="confirm-trade-btn"
            >
              <ShieldCheck size={16} />
              <span>{isCurrentlyExpired ? 'Series Expired' : `Confirm Trade • $${tradeAmount} USDC`}</span>
            </button>
            <button
              className="btn-cancel-review"
              onClick={() => setIsReviewOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 5. Wallet Connection & Verification Step */}
      {isTradeConfirmed && !isReadyForConfirmation && !executionResult && (
        <div className="wallet-step-pane">
          <div className="wallet-step-header">
            <div className="wallet-step-title">
              <Wallet size={15} />
              <span>WALLET CONNECTION</span>
            </div>
            <span className="wallet-step-badge">Somnia Shannon Testnet</span>
          </div>

          {/* Trade parameters reminder */}
          <div className="wallet-trade-summary-card">
            <div className="wts-row">
              <span className="wts-label">Position:</span>
              <span className="wts-value font-mono">
                <strong>{outcomeLabel}</strong> &bull; ${tradeAmount.toFixed(2)} USDC
              </span>
            </div>
            <div className="wts-row">
              <span className="wts-label">Potential Payout:</span>
              <span className="wts-value font-mono text-up">
                ${tradeCalc.potentialPayoutUsdc.toFixed(2)} USDC (+{tradeCalc.returnPercent}%)
              </span>
            </div>
          </div>

          {/* State A: Wallet not connected */}
          {!wallet.isConnected && (
            <div className="wallet-connect-prompt">
              <p className="wallet-prompt-desc">
                Connect your browser wallet to link your Somnia Shannon testnet account.
              </p>

              {wallet.error && (
                <div className="wallet-error-box" role="alert">
                  <AlertTriangle size={13} />
                  <span>{wallet.error}</span>
                </div>
              )}

              <div className="wallet-prompt-actions">
                <button
                  className="btn-connect-wallet-primary"
                  onClick={wallet.connect}
                  disabled={wallet.isConnecting}
                  id="connect-wallet-btn"
                >
                  <Wallet size={16} />
                  <span>{wallet.isConnecting ? 'Connecting…' : 'Connect wallet'}</span>
                </button>
                <button
                  className="btn-back-to-edit"
                  onClick={() => setIsTradeConfirmed(false)}
                >
                  Edit amount
                </button>
              </div>
            </div>
          )}

          {/* State B: Connected but on WRONG network */}
          {wallet.isConnected && !wallet.isCorrectNetwork && (
            <div className="wallet-wrong-network-box">
              <div className="wrong-network-header">
                <AlertTriangle size={16} className="text-down" />
                <strong>Wrong Network Detected</strong>
              </div>
              <p className="wrong-network-desc">
                Your wallet is currently connected to Chain ID {wallet.chainId || 'unknown'}. Umayra Event Contracts operate on <strong>Somnia Shannon Testnet (Chain ID 50312)</strong>.
              </p>

              {wallet.error && (
                <div className="wallet-error-box" role="alert">
                  <span>{wallet.error}</span>
                </div>
              )}

              <div className="wrong-network-actions">
                <button
                  className="btn-switch-network-primary"
                  onClick={wallet.switchNetwork}
                  disabled={wallet.isSwitchingNetwork}
                  id="switch-network-btn"
                >
                  <RefreshCw size={14} className={wallet.isSwitchingNetwork ? 'spin' : ''} />
                  <span>{wallet.isSwitchingNetwork ? 'Switching…' : 'Switch to Somnia Shannon Testnet'}</span>
                </button>
              </div>
            </div>
          )}

          {/* State C: Connected AND on Somnia Shannon Testnet */}
          {wallet.isConnected && wallet.isCorrectNetwork && (
            <div className="wallet-connected-box">
              <div className="wallet-connected-info-grid">
                <div className="wci-item">
                  <span className="wci-label">Wallet connected</span>
                  <span className="wci-value font-mono">{wallet.shortAddress}</span>
                </div>
                <div className="wci-item">
                  <span className="wci-label">Network</span>
                  <span className="wci-value text-live">Somnia Shannon Testnet</span>
                </div>
                <div className="wci-item full-width">
                  <span className="wci-label">Balance</span>
                  <span className="wci-value font-mono">
                    {wallet.nativeBalance || 'Loading...'} {wallet.usdcBalance ? `· ${wallet.usdcBalance}` : ''}
                  </span>
                </div>
              </div>

              <div className="wallet-continue-actions">
                <button
                  className="btn-continue-confirmation"
                  onClick={() => setIsReadyForConfirmation(true)}
                  id="continue-to-confirmation-btn"
                >
                  <span>Continue to confirmation</span>
                  <ArrowRight size={15} />
                </button>
                <button
                  className="btn-back-to-edit"
                  onClick={() => setIsTradeConfirmed(false)}
                >
                  Edit trade
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Final Confirmation Screen (Prior to Wallet Signature Request) */}
      {isReadyForConfirmation && !executionResult && (
        <div className="wallet-ready-state">
          <div className="wallet-ready-header">
            <div className="wallet-ready-badge">
              <ShieldCheck size={16} className="text-accent" />
              <span>FINAL TRADE CONFIRMATION</span>
            </div>
            <span className="ready-network-tag">Somnia Shannon &bull; 50312</span>
          </div>

          <div className="wallet-ready-card">
            <div className="ready-summary-row">
              <span className="ready-label">Asset:</span>
              <span className="ready-value font-bold">{market.asset}</span>
            </div>
            <div className="ready-summary-row">
              <span className="ready-label">Direction:</span>
              <span className="ready-value font-bold">{outcomeLabel}</span>
            </div>
            <div className="ready-summary-row">
              <span className="ready-label">Event Contract:</span>
              <span className="ready-value font-mono">{market.symbol}</span>
            </div>
            <div className="ready-summary-row">
              <span className="ready-label">Entry Price / Probability:</span>
              <span className="ready-value font-mono">
                ${activePricing.pricePerShare.toFixed(2)} ({activePricing.impliedProbabilityPercent}% Implied)
              </span>
            </div>
            <div className="ready-summary-row">
              <span className="ready-label">Trade Amount:</span>
              <span className="ready-value font-mono font-bold">${tradeAmount.toFixed(2)} USDC</span>
            </div>
            <div className="ready-summary-row">
              <span className="ready-label">Expiry:</span>
              <span className="ready-value font-mono">~{timeRemainingStr} ({market.expiryDateString.slice(0, 22)})</span>
            </div>
            <div className="ready-summary-row highlight">
              <span className="ready-label">Potential Payout:</span>
              <span className="ready-value font-mono text-up font-bold">
                ${tradeCalc.potentialPayoutUsdc.toFixed(2)} USDC (+{tradeCalc.returnPercent}%)
              </span>
            </div>
          </div>

          {/* Expiry Alert if expired before wallet submission */}
          {isCurrentlyExpired && (
            <div className="wallet-error-box" role="alert" style={{ marginBottom: '14px' }}>
              <AlertTriangle size={15} />
              <span>This market reached its expiry timestamp while open. Trades cannot be confirmed on expired series.</span>
            </div>
          )}

          {/* Submitting progress banner or primary confirm button */}
          {isExecuting ? (
            <div className="executing-banner">
              <Loader2 size={20} className="spin text-accent" />
              <div className="executing-text">
                <strong>Submitting your prediction…</strong>
                <span>Please approve the transaction request in your browser wallet.</span>
              </div>
            </div>
          ) : (
            <div className="wallet-ready-actions">
              <button
                className="btn-confirm-final-trade"
                onClick={handleFinalConfirmTrade}
                disabled={isExecuting || isCurrentlyExpired}
                id="execute-trade-btn"
              >
                <ShieldCheck size={16} />
                <span>{isCurrentlyExpired ? 'Series Expired' : `Confirm trade • $${tradeAmount} USDC`}</span>
              </button>
              <button
                className="btn-modify-trade"
                onClick={() => {
                  setIsReadyForConfirmation(false);
                  setIsTradeConfirmed(true);
                }}
                disabled={isExecuting}
              >
                <RotateCcw size={13} />
                <span>Back</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7. Post-Execution Result State ("Prediction placed" or Error) */}
      {executionResult && (
        <div className={`execution-result-pane ${executionResult.success ? 'success' : 'failed'}`}>
          <div className="result-header">
            {executionResult.success ? (
              <>
                <CheckCircle2 size={22} className="text-success" />
                <div className="result-title-group">
                  <strong>Prediction placed</strong>
                  <span className="result-subtitle">{executionResult.statusMessage}</span>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle size={22} className="text-down" />
                <div className="result-title-group">
                  <strong>Order Not Completed</strong>
                  <span className="result-subtitle">{executionResult.statusMessage}</span>
                </div>
              </>
            )}
          </div>

          {executionResult.success ? (
            <div className="result-details-card">
              <div className="result-row">
                <span className="result-label">Market:</span>
                <span className="result-value font-mono">{executionResult.marketSymbol}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Direction:</span>
                <span className="result-value font-bold">{executionResult.direction === 'UP' ? 'UP (YES)' : 'DOWN (NO)'}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Amount:</span>
                <span className="result-value font-mono">${executionResult.tradeAmountUsdc.toFixed(2)} USDC</span>
              </div>
              <div className="result-row">
                <span className="result-label">Execution Price:</span>
                <span className="result-value font-mono">${executionResult.executionPrice.toFixed(4)}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Contracts Received:</span>
                <span className="result-value font-mono">{executionResult.sharesReceived} shares</span>
              </div>
              <div className="result-row">
                <span className="result-label">Expiry:</span>
                <span className="result-value font-mono">{market.expiryDateString}</span>
              </div>
              {executionResult.txHash && (
                <div className="result-row tx-hash-row">
                  <span className="result-label">Transaction Hash:</span>
                  <span className="result-value font-mono">
                    {executionResult.txHash.slice(0, 10)}...{executionResult.txHash.slice(-8)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="result-error-card">
              <p className="result-error-message">{executionResult.error || 'The transaction could not be submitted.'}</p>
            </div>
          )}

          <div className="result-actions">
            {executionResult.success && executionResult.explorerUrl && (
              <a
                href={executionResult.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-view-explorer"
              >
                <span>View on Somnia Explorer</span>
                <ExternalLink size={14} />
              </a>
            )}
            
            {!executionResult.success && (
              <button
                className="btn-retry-trade"
                onClick={() => setExecutionResult(null)}
              >
                <span>Try again</span>
              </button>
            )}

            {onResetChat && (
              <button
                className="btn-new-prediction-secondary"
                onClick={onResetChat}
              >
                <span>Make another prediction</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 8. Technical On-Chain Verification Footnote */}
      <div className="trade-review-footer">
        <div className="footer-item">
          <Clock size={11} />
          <span>Cadence: {market.intervalSec < 60 ? `${market.intervalSec}s` : `${Math.round(market.intervalSec / 60)}m`}</span>
        </div>
        <div className="footer-item">
          <span className="status-indicator-dot" />
          <span>On-Chain Status: Code {market.onchainStatusCode ?? 1} (Trading)</span>
        </div>
        <div className="footer-item font-mono">
          <span>Token: {tokenSnippet}...</span>
        </div>
      </div>
    </div>
  );
};
