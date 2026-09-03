import { somniaClient } from '../src/lib/somniaClient';

async function inspect() {
  const markets = await somniaClient.listBinaryMarkets({ limit: 5 });
  console.log('Discovered', markets.length, 'markets');
  if (markets.length > 0) {
    const m = markets[0];
    console.log('Market 0:', {
      marketId: m.marketId,
      asset: m.asset,
      strike: m.strike,
      poolAddress: m.poolAddress,
      marketAddress: m.marketAddress,
      collateral: m.collateral,
      yesTokenId: m.yesTokenId,
      noTokenId: m.noTokenId,
      status: m.status,
    });

    const onchain = await somniaClient.getMarketOnchain(m.marketId as `0x${string}`);
    console.log('Onchain:', onchain);

    // Let's inspect methods on somniaClient
    console.log('Client keys with "Book" or "Binary" or "Quote" or "Order":', 
      Object.keys(somniaClient).filter(k => /book|binary|quote|price|market|pool|order/i.test(k))
    );

    // Check if getBinaryOrderBook exists
    if (typeof (somniaClient as any).getBinaryOrderBook === 'function') {
      try {
        const book = await (somniaClient as any).getBinaryOrderBook(m.marketId);
        console.log('Order book:', book);
      } catch (err: any) {
        console.log('getBinaryOrderBook error:', err?.message || err);
      }
    }
  }
}

inspect().catch(console.error);
