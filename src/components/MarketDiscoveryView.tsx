import React, { useState } from 'react';
import { 
  RefreshCw, 
  Search, 
  AlertCircle, 
  Check, 
  Shield, 
  Layers, 
  SlidersHorizontal,
  Flame
} from 'lucide-react';
import { useMarketDiscovery } from '../hooks/useMarketDiscovery';
import { MetricsHeader } from './MetricsHeader';
import { MarketCard } from './MarketCard';
import type { SupportedAsset } from '../types/market';

export const MarketDiscoveryView: React.FC = () => {
  const {
    markets,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    stats,
    filter,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    setAssetFilter,
    setTradableOnly,
    setSearchQuery,
    refetch,
  } = useMarketDiscovery({ asset: 'ALL', tradableOnly: false }, 12000);

  const [searchInput, setSearchInput] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setSearchQuery(e.target.value);
  };

  return (
    <div className="discovery-layout">
      {/* Top Banner Context */}
      <div className="discovery-hero">
        <div className="discovery-title-row">
          <div>
            <div className="hero-category-tag">
              <Flame size={14} /> SOMNIA SHANNON TESTNET &bull; EVENT CONTRACTS
            </div>
            <h1 className="discovery-main-title">Market Discovery Engine</h1>
            <p className="discovery-subtitle">
              Live read-only stream of decentralized BTC and ETH binary prediction markets on Somnia. Verified on-chain via DreamDEX order books.
            </p>
          </div>

          <div className="hero-actions">
            <div className="refresh-control-group">
              <button 
                className="btn-refresh" 
                onClick={refetch} 
                disabled={isLoading || isRefreshing}
                title="Force refresh now"
              >
                <RefreshCw size={15} className={isRefreshing ? 'spin-icon' : ''} />
                <span>{isRefreshing ? 'Scanning Chain...' : 'Refresh'}</span>
              </button>

              <button 
                className={`btn-auto-toggle ${autoRefreshEnabled ? 'active' : ''}`}
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                title="Toggle 12s background discovery auto-refresh"
              >
                <span className="auto-pulse-dot"></span>
                <span>Auto-Sync: {autoRefreshEnabled ? 'ON (12s)' : 'OFF'}</span>
              </button>
            </div>

            {lastUpdated && (
              <span className="last-sync-tag">
                Last checked: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Global Statistics Cards */}
        <MetricsHeader 
          stats={stats} 
        />
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="controls-bar">
        <div className="asset-filter-tabs">
          {(['ALL', 'BTC', 'ETH'] as SupportedAsset[]).map(asset => (
            <button
              key={asset}
              className={`filter-tab ${filter.asset === asset ? 'active' : ''} ${asset.toLowerCase()}`}
              onClick={() => setAssetFilter(asset)}
            >
              {asset === 'ALL' ? 'All Assets' : `${asset} Markets`}
            </button>
          ))}
        </div>

        <div className="controls-right-group">
          {/* Tradable Switch */}
          <button 
            className={`btn-filter-toggle ${filter.tradableOnly ? 'active' : ''}`}
            onClick={() => setTradableOnly(!filter.tradableOnly)}
          >
            <SlidersHorizontal size={14} />
            <span>Active & Tradable Only</span>
            {filter.tradableOnly && <Check size={14} />}
          </button>

          {/* Search Box */}
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search strike, symbol, or ID..."
              value={searchInput}
              onChange={handleSearchChange}
              className="search-input"
            />
            {searchInput && (
              <button 
                className="btn-clear-search" 
                onClick={() => { setSearchInput(''); setSearchQuery(''); }}
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="markets-display-area">
        {/* Error State */}
        {error && (
          <div className="discovery-error-box">
            <AlertCircle size={24} className="text-danger" />
            <div className="error-content">
              <h3>Testnet Discovery Failed</h3>
              <p>{error}</p>
              <button className="btn-retry" onClick={refetch}>
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="markets-grid">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="market-card-skeleton">
                <div className="skeleton-line line-header"></div>
                <div className="skeleton-line line-strike"></div>
                <div className="skeleton-line line-desc"></div>
                <div className="skeleton-pill-group">
                  <div className="skeleton-pill"></div>
                  <div className="skeleton-pill"></div>
                </div>
                <div className="skeleton-line line-footer"></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && markets.length === 0 && (
          <div className="empty-markets-box">
            <div className="empty-icon-wrap">
              <Layers size={36} />
            </div>
            <h3>No Markets Found Matching Filters</h3>
            <p>
              {filter.tradableOnly 
                ? 'No markets are currently in the live unexpired Trading phase for this filter. Somnia series expire and renew periodically.'
                : 'Try adjusting your search criteria or asset filter.'}
            </p>
            {filter.tradableOnly && (
              <button 
                className="btn-reset-filters" 
                onClick={() => { setTradableOnly(false); setAssetFilter('ALL'); setSearchInput(''); setSearchQuery(''); }}
              >
                Show All Discovered Series
              </button>
            )}
          </div>
        )}

        {/* Markets Grid */}
        {!isLoading && !error && markets.length > 0 && (
          <div className="markets-grid">
            {markets.map(market => (
              <MarketCard key={market.marketId} market={market} />
            ))}
          </div>
        )}
      </div>

      {/* Safety & Protocol Footer Note */}
      <div className="discovery-notice-card">
        <Shield size={18} className="text-cyan" />
        <div className="notice-text">
          <strong>Read-Only Market Intelligence Layer:</strong> This service queries live smart contract state from the Somnia Shannon testnet indexer and on-chain RPC nodes. No transactions, private keys, or wallet signatures are requested.
        </div>
      </div>
    </div>
  );
};
