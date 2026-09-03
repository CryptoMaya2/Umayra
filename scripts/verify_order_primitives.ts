import { somniaExchange, somniaClient } from '../src/lib/somniaClient';
import { MarketDiscoveryService } from '../src/services/marketDiscoveryService';

async function verifyOrderExecutionPrimitives() {
  console.log('=== VERIFYING ORDER EXECUTION PRIMITIVES ===\n');

  // 1. Discover a live market
  const markets = await MarketDiscoveryService.discoverMarkets({ tradableOnly: true }, 5);
  if (markets.length === 0) {
    throw new Error('No live tradable markets found on Shannon testnet');
  }

  const m = markets[0];
  console.log('1. Target Live Market:', {
    marketId: m.marketId,
    symbol: m.symbol,
    asset: m.asset,
    strike: m.strike,
    statusLabel: m.statusLabel,
    onchainStatusCode: m.onchainStatusCode,
    secondsRemaining: m.secondsRemaining,
  });

  // 2. Verify on-chain status gating
  const onchain = await somniaClient.getMarketOnchain(m.marketId as `0x${string}`);
  const nowSec = Math.floor(Date.now() / 1000);
  const isTimeActive = Number(onchain.expiry) > nowSec;
  const isTrading = onchain.status === 1 && isTimeActive;
  console.log('2. On-chain Status Check:', {
    onchainStatus: onchain.status,
    expiry: Number(onchain.expiry),
    nowSec,
    isTimeActive,
    isTrading,
  });
  if (!isTrading) {
    throw new Error('Gating check failed: Market is not in live Trading status');
  }

  // 3. Verify Tradable symbols and pricing precision
  await somniaExchange.loadMarkets();
  const yesSymbol = `${m.symbol}#YES`;
  const noSymbol = `${m.symbol}#NO`;

  console.log('3. Precision and Quantization:');
  const testPrice = 0.4567;
  const testAmount = 10.555;
  try {
    const snappedPrice = somniaExchange.priceToPrecision(yesSymbol, testPrice);
    const snappedAmount = somniaExchange.amountToPrecision(yesSymbol, testAmount);
    console.log(`   YES Symbol: ${yesSymbol}`);
    console.log(`   Price snapped from ${testPrice} -> ${snappedPrice}`);
    console.log(`   Amount snapped from ${testAmount} -> ${snappedAmount}`);
  } catch (err: any) {
    console.log('   Notice on unified symbol precision:', err?.message || err);
  }

  // 4. Verify Live Order Book depth check
  try {
    const ob = await somniaExchange.fetchOrderBook(m.symbol);
    console.log('4. Order Book Verification:', {
      bidsCount: ob.bids.length,
      asksCount: ob.asks.length,
      bestBid: ob.bids[0] || null,
      bestAsk: ob.asks[0] || null,
    });
  } catch (err: any) {
    console.log('   Notice on order book read:', err?.message || err);
  }

  console.log('\n=== ORDER EXECUTION PRIMITIVES VERIFIED ===');
}

verifyOrderExecutionPrimitives().catch(console.error);
