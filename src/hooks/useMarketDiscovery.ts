import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketDiscoveryService } from '../services/marketDiscoveryService';
import type { 
  MarketDiscoveryFilter, 
  MarketDiscoveryState,
  SupportedAsset 
} from '../types/market';

export function useMarketDiscovery(
  initialFilter: MarketDiscoveryFilter = { asset: 'ALL', tradableOnly: false },
  autoRefreshIntervalMs: number = 12000
) {
  const [filter, setFilter] = useState<MarketDiscoveryFilter>(initialFilter);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [state, setState] = useState<MarketDiscoveryState>({
    markets: [],
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    stats: {
      totalDiscovered: 0,
      tradableCount: 0,
      btcActiveCount: 0,
      ethActiveCount: 0,
    }
  });

  const isMountedRef = useRef(true);

  const fetchMarkets = useCallback(async (isInitial = false) => {
    setState(prev => ({
      ...prev,
      isLoading: isInitial ? true : prev.isLoading,
      isRefreshing: !isInitial,
      error: isInitial ? null : prev.error,
    }));

    try {
      const allMarkets = await MarketDiscoveryService.discoverMarkets(filter, 60);
      
      if (!isMountedRef.current) return;

      const tradableMarkets = allMarkets.filter(m => m.isTradable);
      const btcActive = tradableMarkets.filter(m => m.asset.toUpperCase() === 'BTC');
      const ethActive = tradableMarkets.filter(m => m.asset.toUpperCase() === 'ETH');

      setState({
        markets: allMarkets,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: new Date(),
        stats: {
          totalDiscovered: allMarkets.length,
          tradableCount: tradableMarkets.length,
          btcActiveCount: btcActive.length,
          ethActiveCount: ethActive.length,
        }
      });
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: err?.message || 'Failed to fetch markets',
      }));
    }
  }, [filter]);

  // Initial load when filter changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchMarkets(true);

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchMarkets]);

  // Periodic Auto-refresh to discover new markets and update expiry states
  useEffect(() => {
    if (!autoRefreshEnabled || autoRefreshIntervalMs <= 0) return;

    const interval = setInterval(() => {
      fetchMarkets(false);
    }, autoRefreshIntervalMs);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, autoRefreshIntervalMs, fetchMarkets]);

  const setAssetFilter = (asset: SupportedAsset) => {
    setFilter(prev => ({ ...prev, asset }));
  };

  const setTradableOnly = (tradableOnly: boolean) => {
    setFilter(prev => ({ ...prev, tradableOnly }));
  };

  const setSearchQuery = (search: string) => {
    setFilter(prev => ({ ...prev, search }));
  };

  const refetch = () => fetchMarkets(false);

  return {
    ...state,
    filter,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    setAssetFilter,
    setTradableOnly,
    setSearchQuery,
    refetch,
  };
}
