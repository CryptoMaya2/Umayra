import { somniaExchange, somniaClient } from '../src/lib/somniaClient';
import { MarketDiscoveryService } from '../src/services/marketDiscoveryService';

async function testLookup() {
  await somniaExchange.loadMarkets();
  const markets = await MarketDiscoveryService.discoverMarkets({ tradableOnly: true }, 5);
  if (markets.length > 0) {
    const m = markets[0];
    const um = Object.values(somniaExchange.markets).find(
      u => u.id.toLowerCase() === m.marketId.toLowerCase()
    );
    console.log('Found unified market:', um?.symbol);
    if (um) {
      const yesSymbol = `${um.symbol}#YES`;
      const noSymbol = `${um.symbol}#NO`;
      console.log('YES Symbol:', yesSymbol);
      const snappedPrice = somniaExchange.priceToPrecision(yesSymbol, 0.4567);
      const snappedAmount = somniaExchange.amountToPrecision(yesSymbol, 10.555);
      console.log('Snapped price:', snappedPrice);
      console.log('Snapped amount:', snappedAmount);
    }
  }
}

testLookup().catch(console.error);
