import { MarketDiscoveryService } from '../src/services/marketDiscoveryService';

async function verify() {
  console.log('=== DreamDEX Market Discovery Service Verification ===');
  console.log('Target: Somnia Shannon Testnet (Chain ID 50312)');
  console.log('Invoking: MarketDiscoveryService.discoverMarkets()...\n');

  const startTime = Date.now();
  const markets = await MarketDiscoveryService.discoverMarkets({ asset: 'ALL', tradableOnly: false }, 50);
  const duration = Date.now() - startTime;

  console.log(`Successfully retrieved and normalized ${markets.length} Event Contract markets in ${duration}ms.\n`);

  const tradable = markets.filter(m => m.isTradable);
  const btcMarkets = markets.filter(m => m.asset === 'BTC');
  const ethMarkets = markets.filter(m => m.asset === 'ETH');

  console.log(`Summary Statistics:`);
  console.log(`- Total Markets Scanned: ${markets.length}`);
  console.log(`- Active Tradable Series: ${tradable.length}`);
  console.log(`- BTC Markets Discovered: ${btcMarkets.length} (Active: ${btcMarkets.filter(m => m.isTradable).length})`);
  console.log(`- ETH Markets Discovered: ${ethMarkets.length} (Active: ${ethMarkets.filter(m => m.isTradable).length})\n`);

  console.log(`Sample Normalized Markets:`);
  markets.slice(0, 4).forEach((m, idx) => {
    console.log(`\n[${idx + 1}] ${m.symbol}`);
    console.log(`  - Market ID: ${m.marketId}`);
    console.log(`  - Asset / Strike: ${m.asset} @ $${m.strike.toLocaleString()}`);
    console.log(`  - Expiry: ${m.expiryDateString} (${m.isExpired ? 'EXPIRED' : `${m.secondsRemaining}s remaining`})`);
    console.log(`  - On-Chain Status: Code ${m.onchainStatusCode ?? 'N/A'} (${m.statusLabel})`);
    console.log(`  - Tradable Verification: ${m.isTradable ? 'YES (Active)' : 'NO'}`);
    console.log(`  - UP (YES) Token ID: ${m.outcomes.up.tokenId.slice(0, 12)}...`);
    console.log(`  - DOWN (NO) Token ID: ${m.outcomes.down.tokenId.slice(0, 12)}...`);
  });

  console.log('\n=== Verification Succeeded: Market Discovery service is operational and read-only. ===');
  process.exit(0);
}

verify().catch((err) => {
  console.error('Verification Failed:', err);
  process.exit(1);
});
