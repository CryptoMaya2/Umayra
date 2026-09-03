import React from 'react';
import { Activity, Zap, TrendingUp, Radio } from 'lucide-react';
import type { MarketDiscoveryState } from '../types/market';

interface MetricsHeaderProps {
  stats: MarketDiscoveryState['stats'];
}

export const MetricsHeader: React.FC<MetricsHeaderProps> = ({ stats }) => {
  return (
    <div className="metrics-summary-grid">
      <div className="metric-box">
        <div className="metric-box-top">
          <span className="metric-title">TOTAL DISCOVERED</span>
          <div className="metric-icon-wrap cyan">
            <Radio size={16} />
          </div>
        </div>
        <div className="metric-number-row">
          <span className="metric-number">{stats.totalDiscovered}</span>
          <span className="metric-subtext">Indexer Scanned</span>
        </div>
      </div>

      <div className="metric-box highlight">
        <div className="metric-box-top">
          <span className="metric-title">LIVE TRADABLE MARKETS</span>
          <div className="metric-icon-wrap green">
            <Zap size={16} />
          </div>
        </div>
        <div className="metric-number-row">
          <span className="metric-number text-green">{stats.tradableCount}</span>
          <span className="metric-subtext">Active On-Chain</span>
        </div>
      </div>

      <div className="metric-box">
        <div className="metric-box-top">
          <span className="metric-title">ACTIVE BTC SERIES</span>
          <div className="metric-icon-wrap orange">
            <TrendingUp size={16} />
          </div>
        </div>
        <div className="metric-number-row">
          <span className="metric-number text-orange">{stats.btcActiveCount}</span>
          <span className="metric-subtext">BTC Up/Down</span>
        </div>
      </div>

      <div className="metric-box">
        <div className="metric-box-top">
          <span className="metric-title">ACTIVE ETH SERIES</span>
          <div className="metric-icon-wrap purple">
            <Activity size={16} />
          </div>
        </div>
        <div className="metric-number-row">
          <span className="metric-number text-purple">{stats.ethActiveCount}</span>
          <span className="metric-subtext">ETH Up/Down</span>
        </div>
      </div>
    </div>
  );
};
