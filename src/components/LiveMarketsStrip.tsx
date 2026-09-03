import React from 'react';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { useMarketDiscovery } from '../hooks/useMarketDiscovery';
import type { NormalizedEventMarket } from '../types/market';

interface LiveMarketsStripProps {
  maxItems?: number;
}

function formatExpiry(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return 'Expired';
  if (secondsRemaining < 60) return `${secondsRemaining}s`;
  if (secondsRemaining < 3600) return `${Math.round(secondsRemaining / 60)}m`;
  return `${Math.round(secondsRemaining / 3600)}h`;
}

function MarketItem({ market }: { market: NormalizedEventMarket }) {
  const assetClass = market.asset.toLowerCase() === 'btc' ? 'btc' : 'eth';

  return (
    <div className="live-market-item">
      <div className="lmi-header">
        <span className={`lmi-asset ${assetClass}`}>
          {market.asset} / USDC
        </span>
        <span className="lmi-live">
          <span className="lmi-live-dot" />
          LIVE
        </span>
      </div>

      <div>
        <div className="lmi-strike">
          {market.strike > 0
            ? `$${market.strike.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : '—'}
        </div>
        <div className="lmi-strike-label">Strike price</div>
      </div>

      <div className="lmi-outcomes">
        <div className="lmi-outcome up">
          <ArrowUpRight size={11} />
          UP
        </div>
        <div className="lmi-outcome down">
          <ArrowDownRight size={11} />
          DOWN
        </div>
      </div>

      <div className="lmi-footer">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Clock size={10} />
          {formatExpiry(market.secondsRemaining)}
        </span>
        <span>{market.shortMarketId}</span>
      </div>
    </div>
  );
}

export const LiveMarketsStrip: React.FC<LiveMarketsStripProps> = ({ maxItems = 6 }) => {
  const { markets, isLoading, error, stats } = useMarketDiscovery(
    { asset: 'ALL', tradableOnly: true },
    30000
  );

  const displayMarkets = markets.slice(0, maxItems);

  return (
    <section className="live-markets-section section" id="markets">
      <div className="container">
        <div className="live-markets-header">
          <div>
            <div className="section-label">Live Event Contracts</div>
            <h2 className="section-title">
              Active markets, right now.
            </h2>
          </div>
          {!isLoading && !error && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {stats.tradableCount} tradable · {stats.btcActiveCount} BTC · {stats.ethActiveCount} ETH
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Somnia Shannon testnet
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="live-markets-loading">
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Connecting to Somnia Shannon testnet…
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div className="live-markets-empty">
            <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>Testnet unavailable</div>
            <div style={{ fontSize: '0.78rem' }}>{error}</div>
          </div>
        )}

        {!isLoading && !error && displayMarkets.length === 0 && (
          <div className="live-markets-empty">
            <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>No tradable markets right now</div>
            <div style={{ fontSize: '0.78rem' }}>Markets are discovered live from the DreamDEX indexer. Check back soon.</div>
          </div>
        )}

        {!isLoading && !error && displayMarkets.length > 0 && (
          <div className="live-markets-grid">
            {displayMarkets.map(market => (
              <MarketItem key={market.marketId} market={market} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
