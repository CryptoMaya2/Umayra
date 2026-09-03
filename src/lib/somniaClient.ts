import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES, type MarketOnchain, type BinaryMarket } from '@somnia-chain/markets-sdk';
import { somniaShannon } from '@somnia-chain/markets-sdk/chains';

/** Official Somnia Shannon Testnet Configuration */
export const SHANNON_MARKETS_CONFIG = {
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  addresses: SOMNIA_TESTNET_ADDRESSES,
} as const;

/** Read-only SomniaMarkets exchange instance */
export const somniaExchange = new SomniaMarkets(SHANNON_MARKETS_CONFIG);

/** Direct access to the underlying SomniaMarketsClient */
export const somniaClient = somniaExchange.client;

export interface MarketWithOnchain {
  market: BinaryMarket;
  onchain?: MarketOnchain;
  isTradable: boolean;
}

/**
 * Discovers binary event markets and verifies live on-chain status
 */
export async function discoverBinaryMarkets(limit = 50): Promise<MarketWithOnchain[]> {
  const binaryMarkets = await somniaClient.listBinaryMarkets({ limit });
  const nowSec = Math.floor(Date.now() / 1000);

  const results: MarketWithOnchain[] = await Promise.all(
    binaryMarkets.map(async (market) => {
      try {
        if (market.marketId) {
          const onchain = await somniaClient.getMarketOnchain(market.marketId as `0x${string}`);
          const isTimeActive = Number(onchain.expiry) > nowSec;
          const isTradable = onchain.status === 1 && isTimeActive;
          return { market, onchain, isTradable };
        }
      } catch {
        // Degrade gracefully if point read is unavailable
      }
      return { market, isTradable: false };
    })
  );

  return results;
}
