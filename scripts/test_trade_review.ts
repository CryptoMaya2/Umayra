import { IntentParserService } from '../src/services/intentParserService';
import { MarketMatcherService } from '../src/services/marketMatcherService';
import { TradeReviewService } from '../src/services/tradeReviewService';
import { somniaExchange } from '../src/lib/somniaClient';

async function testTradeReview() {
  console.log('=== RUNNING TRADE REVIEW & CALCULATION TESTS ===\n');

  // Test 1: BTC Prediction & Trade Review Calculation
  console.log('1. Testing Trade Review for BTC Prediction: "I think BTC will go up in the next two hours."');
  const btcIntent = IntentParserService.parse('I think BTC will go up in the next two hours.');
  const btcMatch = await MarketMatcherService.matchIntent(btcIntent);

  if (!btcMatch.hasMatch || !btcMatch.matchedMarket) {
    throw new Error('BTC Market match failed');
  }

  const btcPricing = await TradeReviewService.getLivePricing(btcMatch.matchedMarket, 'UP');
  console.log('   Live Pricing Data from Somnia:', {
    marketSymbol: btcMatch.matchedMarket.symbol,
    asset: btcMatch.matchedMarket.asset,
    direction: 'UP',
    pricePerShare: `$${btcPricing.pricePerShare}`,
    impliedProbability: `${btcPricing.impliedProbabilityPercent}%`,
    availableLiquidity: `$${btcPricing.availableLiquidityUsdc} USDC`,
    bestBid: btcPricing.bestBid,
    bestAsk: btcPricing.bestAsk,
  });

  const btcTrade10 = TradeReviewService.calculateTrade(10, btcPricing);
  console.log('   Calculated Trade (10 USDC):', {
    amountIn: `$${btcTrade10.tradeAmountUsdc} USDC`,
    sharesReceived: `${btcTrade10.estimatedContracts} shares`,
    potentialPayout: `$${btcTrade10.potentialPayoutUsdc} USDC`,
    netProfit: `+$${btcTrade10.netProfitUsdc} USDC (+${btcTrade10.returnPercent}%)`,
    liquiditySufficient: btcTrade10.isLiquiditySufficient,
  });

  if (btcTrade10.potentialPayoutUsdc <= 0 || btcTrade10.estimatedContracts <= 0) {
    throw new Error('BTC Trade calculation yielded invalid results');
  }

  // Test 2: ETH Prediction & Trade Review Calculation
  console.log('\n2. Testing Trade Review for ETH Prediction: "I think ETH will go down in the next hour."');
  const ethIntent = IntentParserService.parse('I think ETH will go down in the next hour.');
  const ethMatch = await MarketMatcherService.matchIntent(ethIntent);

  if (!ethMatch.hasMatch || !ethMatch.matchedMarket) {
    throw new Error('ETH Market match failed');
  }

  const ethPricing = await TradeReviewService.getLivePricing(ethMatch.matchedMarket, 'DOWN');
  console.log('   Live Pricing Data from Somnia:', {
    marketSymbol: ethMatch.matchedMarket.symbol,
    asset: ethMatch.matchedMarket.asset,
    direction: 'DOWN',
    pricePerShare: `$${ethPricing.pricePerShare}`,
    impliedProbability: `${ethPricing.impliedProbabilityPercent}%`,
    availableLiquidity: `$${ethPricing.availableLiquidityUsdc} USDC`,
  });

  const ethTrade50 = TradeReviewService.calculateTrade(50, ethPricing);
  console.log('   Calculated Trade (50 USDC):', {
    amountIn: `$${ethTrade50.tradeAmountUsdc} USDC`,
    sharesReceived: `${ethTrade50.estimatedContracts} shares`,
    potentialPayout: `$${ethTrade50.potentialPayoutUsdc} USDC`,
    netProfit: `+$${ethTrade50.netProfitUsdc} USDC (+${ethTrade50.returnPercent}%)`,
    liquiditySufficient: ethTrade50.isLiquiditySufficient,
  });

  if (ethTrade50.potentialPayoutUsdc <= 0 || ethTrade50.estimatedContracts <= 0) {
    throw new Error('ETH Trade calculation yielded invalid results');
  }

  // Test 3: Safety verification: Confirm no wallet signer configured & no broadcast occurs
  console.log('\n3. Verifying Read-Only Safety Guarantees:');
  console.log('   Wallet Address configured in exchange:', somniaExchange.walletAddress ?? 'None (Read-Only)');
  if (somniaExchange.walletAddress !== undefined) {
    throw new Error('Safety check failed: A wallet signer was unexpectedly configured');
  }
  console.log('   Confirmed: Zero transactions broadcast, zero wallet signatures requested.');

  console.log('\n=== ALL TRADE REVIEW TESTS PASSED ===');
}

testTradeReview().catch((err) => {
  console.error('Trade review test failed:', err);
  process.exit(1);
});
