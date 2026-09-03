import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Layers
} from 'lucide-react';
import type { NormalizedEventMarket } from '../types/market';

interface MarketCardProps {
  market: NormalizedEventMarket;
}

export const MarketCard: React.FC<MarketCardProps> = ({ market }) => {
  const isBtc = market.asset.toUpperCase() === 'BTC';

  const formatRemainingTime = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      return `${hours}h ${mins % 60}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getStatusBadge = () => {
    if (market.isTradable) {
      return (
        <span className="badge badge-active">
          <span className="pulse-dot"></span>
          LIVE TRADING
        </span>
      );
    }
    if (market.winningLabel === 'UP') {
      return <span className="badge badge-resolved-up">RESOLVED UP</span>;
    }
    if (market.winningLabel === 'DOWN') {
      return <span className="badge badge-resolved-down">RESOLVED DOWN</span>;
    }
    if (market.isExpired) {
      return <span className="badge badge-expired">EXPIRED / SETTLING</span>;
    }
    return <span className="badge badge-neutral">{market.statusLabel.toUpperCase()}</span>;
  };

  return (
    <div className={`market-card ${market.isTradable ? 'market-card-tradable' : 'market-card-inactive'}`}>
      <div className="market-card-header">
        <div className="asset-tag-group">
          <div className={`asset-icon-pill ${isBtc ? 'asset-btc' : 'asset-eth'}`}>
            <span className="asset-symbol">{market.asset}</span>
          </div>
          <div className="market-interval-pill">
            {market.intervalSec < 60 ? `${market.intervalSec}s` : `${market.intervalSec / 60}m`} Series
          </div>
        </div>
        {getStatusBadge()}
      </div>

      <div className="market-strike-section">
        <div className="strike-meta-label">TARGET STRIKE PRICE</div>
        <div className="strike-value-row">
          {market.strike > 0 ? (
            <>
              <span className="strike-currency">$</span>
              <span className="strike-amount">{market.strike.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </>
          ) : (
            <span className="strike-amount" style={{ fontSize: '1.45rem' }}>Open Ref Price</span>
          )}
        </div>
        <div className="market-question-text" title={market.question}>
          {market.question}
        </div>
      </div>

      {/* Binary Outcomes Overview */}
      <div className="outcomes-container">
        <div className={`outcome-pill outcome-up ${market.winningOutcome === 0 ? 'outcome-winner' : ''}`}>
          <div className="outcome-header">
            <span className="outcome-name">
              <ArrowUpRight size={15} /> UP (YES)
            </span>
            {market.winningOutcome === 0 && <span className="outcome-win-tag">WON</span>}
          </div>
          <div className="outcome-token-id" title={`ERC-6909 Token ID: ${market.outcomes.up.tokenId}`}>
            ID: {market.outcomes.up.tokenId.slice(0, 8)}...
          </div>
        </div>

        <div className={`outcome-pill outcome-down ${market.winningOutcome === 1 ? 'outcome-winner' : ''}`}>
          <div className="outcome-header">
            <span className="outcome-name">
              <ArrowDownRight size={15} /> DOWN (NO)
            </span>
            {market.winningOutcome === 1 && <span className="outcome-win-tag">WON</span>}
          </div>
          <div className="outcome-token-id" title={`ERC-6909 Token ID: ${market.outcomes.down.tokenId}`}>
            ID: {market.outcomes.down.tokenId.slice(0, 8)}...
          </div>
        </div>
      </div>

      {/* Market Metadata Footer */}
      <div className="market-meta-grid">
        <div className="meta-item">
          <span className="meta-label">
            <Clock size={12} /> Time Left
          </span>
          <span className={`meta-value ${market.secondsRemaining > 0 && market.secondsRemaining <= 120 ? 'text-warning' : ''}`}>
            {formatRemainingTime(market.secondsRemaining)}
          </span>
        </div>

        <div className="meta-item">
          <span className="meta-label">
            <Activity size={12} /> On-Chain Status
          </span>
          <span className="meta-value font-mono">
            {market.onchainStatusCode !== null ? `Code ${market.onchainStatusCode} (${market.statusLabel})` : 'Indexed'}
          </span>
        </div>

        <div className="meta-item">
          <span className="meta-label">
            <Layers size={12} /> Market ID
          </span>
          <span className="meta-value font-mono text-muted" title={market.marketId}>
            {market.shortMarketId}
          </span>
        </div>

        <div className="meta-item">
          <span className="meta-label">Tradable Check</span>
          <span className="meta-value">
            {market.isTradable ? (
              <span className="text-success flex-center gap-1">
                <CheckCircle2 size={13} /> Verified
              </span>
            ) : (
              <span className="text-muted flex-center gap-1">
                <XCircle size={13} /> Inactive
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
