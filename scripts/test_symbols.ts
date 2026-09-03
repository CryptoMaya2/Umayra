import { somniaExchange, somniaClient } from '../src/lib/somniaClient';

async function testSymbols() {
  await somniaExchange.loadMarkets();
  const markets = await somniaClient.listBinaryMarkets({ limit: 3 });
  if (markets.length > 0) {
    const m = markets[0];
    console.log('Testing market resolution for marketId:', m.marketId);
    
    // Find matching unified market
    const um = Object.values(somniaExchange.markets).find(
      u => u.id.toLowerCase() === m.marketId.toLowerCase()
    );
    console.log('Unified market symbol:', um?.symbol);

    if (um) {
      const yesTradable = `${um.symbol}#YES`;
      const noTradable = `${um.symbol}#NO`;
      console.log('YES Tradable Symbol:', yesTradable);
      console.log('NO Tradable Symbol:', noTradable);

      const tradableYes = somniaExchange.market(yesTradable);
      console.log('Resolved Tradable YES:', {
        symbol: tradableYes.symbol,
        base: tradableYes.base,
        quote: tradableYes.quote,
        marketType: tradableYes.marketType,
      });

      const snappedPrice = somniaExchange.priceToPrecision(yesTradable, 0.45678);
      const snappedAmount = somniaExchange.amountToPrecision(yesTradable, 12.34567);
      console.log('Price to precision (0.45678):', snappedPrice);
      console.log('Amount to precision (12.34567):', snappedAmount);
    }
  }
}

testSymbols().catch(console.error);
