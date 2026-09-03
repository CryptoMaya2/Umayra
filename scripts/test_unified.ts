import { somniaExchange, somniaClient } from '../src/lib/somniaClient';

async function testUnified() {
  const markets = await somniaClient.listBinaryMarkets({ limit: 5 });
  console.log('List binary markets count:', markets.length);
  if (markets.length > 0) {
    const m = markets[0];
    console.log('Raw Market:', {
      id: m.marketId,
      asset: m.asset,
      strike: m.strike,
      pool: m.poolAddress,
      marketAddress: m.marketAddress,
      collateral: m.collateral,
      yesToken: m.yesTokenId,
      noToken: m.noTokenId,
    });

    try {
      await somniaExchange.loadMarkets();
      console.log('Symbols loaded in exchange:', Object.keys(somniaExchange.markets).slice(0, 10));
      
      const symbol = Object.keys(somniaExchange.markets)[0];
      if (symbol) {
        const ob = await somniaExchange.fetchOrderBook(symbol);
        console.log('Order book for', symbol, ':', {
          bids: ob.bids.slice(0, 3),
          asks: ob.asks.slice(0, 3),
        });
      }
    } catch (e: any) {
      console.log('Exchange loadMarkets / fetchOrderBook notice:', e?.message || e);
    }
  }
}

testUnified().catch(console.error);
