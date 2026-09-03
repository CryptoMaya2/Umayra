import { somniaExchange, somniaClient } from '../src/lib/somniaClient';

async function testOrderBook() {
  await somniaExchange.loadMarkets();
  const symbols = Object.keys(somniaExchange.markets);
  console.log('Total symbols:', symbols.length);
  for (const sym of symbols.slice(0, 3)) {
    const ob = await somniaExchange.fetchOrderBook(sym);
    console.log(`\nSymbol: ${sym}`);
    console.log('Best Bid (Probability to Sell):', ob.bids[0] || 'No bids');
    console.log('Best Ask (Probability to Buy):', ob.asks[0] || 'No asks');
    const totalBidLiquidity = ob.bids.reduce((sum, [p, q]) => sum + p * q, 0);
    const totalAskLiquidity = ob.asks.reduce((sum, [p, q]) => sum + p * q, 0);
    console.log(`Total Bid Liquidity: $${totalBidLiquidity.toFixed(2)}, Total Ask Liquidity: $${totalAskLiquidity.toFixed(2)}`);
  }
}

testOrderBook().catch(console.error);
