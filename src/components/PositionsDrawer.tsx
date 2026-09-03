import React, { useState } from 'react';
import { 
  X, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle2, 
  ExternalLink, 
  Loader2, 
  Coins, 
  RotateCcw,
  Sparkles,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { usePositions } from '../hooks/usePositions';
import { useWalletContext } from '../context/WalletContext';
import type { PositionStatus } from '../types/position';

interface PositionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type PositionFilter = 'ALL' | 'ACTIVE' | 'CLAIMABLE' | 'HISTORY';

export const PositionsDrawer: React.FC<PositionsDrawerProps> = ({ isOpen, onClose }) => {
  const wallet = useWalletContext();
  const { 
    positions, 
    isLoading, 
    claimingPositionId, 
    claimResult, 
    activeCount, 
    claimableCount, 
    refreshPositions, 
    claimWinnings 
  } = usePositions(wallet.address);

  const [activeFilter, setActiveFilter] = useState<PositionFilter>('ALL');

  if (!isOpen) return null;

  const filteredPositions = positions.filter((p) => {
    if (activeFilter === 'ACTIVE') return p.status === 'ACTIVE' || p.status === 'EXPIRED_SETTLING';
    if (activeFilter === 'CLAIMABLE') return p.status === 'CLAIMABLE' || p.status === 'VOIDED';
    if (activeFilter === 'HISTORY') return p.status === 'CLAIMED' || p.status === 'LOST';
    return true;
  });

  const getStatusBadge = (status: PositionStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="pos-badge live">
            <span className="pos-dot live" />
            LIVE
          </span>
        );
      case 'EXPIRED_SETTLING':
        return (
          <span className="pos-badge settling">
            <Clock size={11} />
            SETTLING
          </span>
        );
      case 'CLAIMABLE':
        return (
          <span className="pos-badge claimable">
            <Sparkles size={11} />
            WON &bull; CLAIMABLE
          </span>
        );
      case 'CLAIMED':
        return (
          <span className="pos-badge claimed">
            <CheckCircle2 size={11} />
            CLAIMED
          </span>
        );
      case 'LOST':
        return (
          <span className="pos-badge lost">
            SETTLED
          </span>
        );
      case 'VOIDED':
        return (
          <span className="pos-badge voided">
            <AlertTriangle size={11} />
            VOIDED
          </span>
        );
    }
  };

  return (
    <div className="positions-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="positions-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <h2 className="drawer-title">My Predictions</h2>
            <span className="drawer-subtitle">Somnia Shannon Testnet</span>
          </div>
          <div className="drawer-header-actions">
            <button
              className="btn-refresh-positions"
              onClick={refreshPositions}
              disabled={isLoading}
              title="Refresh positions"
            >
              <RotateCcw size={14} className={isLoading ? 'spin' : ''} />
            </button>
            <button className="btn-close-drawer" onClick={onClose} aria-label="Close predictions drawer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="drawer-filters">
          <button
            className={`filter-chip ${activeFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveFilter('ALL')}
          >
            All ({positions.length})
          </button>
          <button
            className={`filter-chip ${activeFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setActiveFilter('ACTIVE')}
          >
            Active ({activeCount})
          </button>
          <button
            className={`filter-chip ${activeFilter === 'CLAIMABLE' ? 'active' : ''}`}
            onClick={() => setActiveFilter('CLAIMABLE')}
          >
            Claimable ({claimableCount})
          </button>
          <button
            className={`filter-chip ${activeFilter === 'HISTORY' ? 'active' : ''}`}
            onClick={() => setActiveFilter('HISTORY')}
          >
            History
          </button>
        </div>

        {/* Positions List */}
        <div className="drawer-content">
          {!wallet.isConnected ? (
            <div className="drawer-empty-state">
              <Coins size={32} className="text-muted" />
              <p>Connect your wallet to track your live and settled predictions.</p>
              <button className="btn-connect-wallet-drawer" onClick={wallet.connect}>
                Connect wallet
              </button>
            </div>
          ) : filteredPositions.length === 0 ? (
            <div className="drawer-empty-state">
              <Coins size={32} className="text-muted" />
              <p>No predictions found in this category.</p>
              <span className="empty-state-hint">
                Make a prediction in the chat to see your position here.
              </span>
            </div>
          ) : (
            <div className="positions-list">
              {filteredPositions.map((pos) => {
                const isUp = pos.direction === 'UP';
                const isClaiming = claimingPositionId === pos.id;
                const posClaimResult = claimResult?.id === pos.id ? claimResult.result : null;
                const payoutAmount = pos.sharesCount * 1.00;

                return (
                  <div key={pos.id} className={`position-card ${pos.status.toLowerCase()}`}>
                    <div className="pos-card-header">
                      <div className="pos-asset-row">
                        <span className={`asset-color-dot ${pos.asset.toLowerCase()}`} />
                        <strong>{pos.asset}</strong>
                        <div className={`pos-direction-pill ${isUp ? 'up' : 'down'}`}>
                          {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          <span>{pos.direction}</span>
                        </div>
                      </div>
                      {getStatusBadge(pos.status)}
                    </div>

                    <div className="pos-market-symbol font-mono">
                      {pos.symbol}
                    </div>

                    <div className="pos-stats-grid">
                      <div className="pos-stat">
                        <span className="stat-label">Position</span>
                        <span className="stat-val font-mono">{pos.sharesCount.toFixed(2)} contracts</span>
                      </div>
                      <div className="pos-stat">
                        <span className="stat-label">Entry</span>
                        <span className="stat-val font-mono">${pos.entryPrice.toFixed(2)}</span>
                      </div>
                      <div className="pos-stat">
                        <span className="stat-label">Trade Amount</span>
                        <span className="stat-val font-mono">${pos.tradeAmountUsdc.toFixed(2)} USDC</span>
                      </div>
                      <div className="pos-stat">
                        <span className="stat-label">Target Strike</span>
                        <span className="stat-val font-mono">${pos.strike.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Live probability or resolution note */}
                    {pos.status === 'ACTIVE' && pos.currentProbability !== undefined && (
                      <div className="pos-live-probability">
                        <TrendingUp size={12} />
                        <span>Current probability: {pos.currentProbability}%</span>
                      </div>
                    )}

                    {/* Expiry Timestamp */}
                    <div className="pos-expiry-row">
                      <Clock size={11} />
                      <span>{pos.expiryDateString || `Expiry: ${pos.expiryTimestamp}`}</span>
                    </div>

                    {/* Claimable Action Button */}
                    {(pos.status === 'CLAIMABLE' || pos.status === 'VOIDED') && (
                      <div className="pos-claim-action-box">
                        <div className="claim-payout-info">
                          <span className="claim-label">Winnings Available:</span>
                          <span className="claim-value text-up font-mono font-bold">
                            +${payoutAmount.toFixed(2)} USDC
                          </span>
                        </div>
                        <button
                          className="btn-claim-winnings-primary"
                          onClick={() => claimWinnings(pos)}
                          disabled={isClaiming}
                        >
                          {isClaiming ? (
                            <>
                              <Loader2 size={15} className="spin" />
                              <span>Claiming winnings…</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={15} />
                              <span>Claim winnings &bull; ${payoutAmount.toFixed(2)} USDC</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Claimed Status Confirmation */}
                    {pos.status === 'CLAIMED' && (
                      <div className="pos-claimed-box">
                        <CheckCircle2 size={14} className="text-success" />
                        <span>Winnings claimed: +${(pos.claimedAmountUsdc || payoutAmount).toFixed(2)} USDC</span>
                        {pos.claimTxHash && (
                          <a
                            href={`https://shannon-explorer.somnia.network/tx/${pos.claimTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="claimed-tx-link"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Claim Error Message */}
                    {posClaimResult && !posClaimResult.success && (
                      <div className="pos-claim-error">
                        <AlertTriangle size={13} />
                        <span>{posClaimResult.error || 'Failed to claim'}</span>
                      </div>
                    )}

                    {/* Order Tx Link */}
                    {pos.txHash && (
                      <div className="pos-footer-tx">
                        <a
                          href={`https://shannon-explorer.somnia.network/tx/${pos.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pos-tx-link"
                        >
                          <span>Tx: {pos.txHash.slice(0, 8)}...{pos.txHash.slice(-6)}</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
