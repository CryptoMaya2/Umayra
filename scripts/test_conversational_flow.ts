import { IntentParserService } from '../src/services/intentParserService';
import { MarketMatcherService } from '../src/services/marketMatcherService';
import { MarketDiscoveryService } from '../src/services/marketDiscoveryService';

async function runTests() {
  console.log('=== RUNNING CONVERSATIONAL PREDICTION FLOW TESTS ===\n');

  // Test 1: Full BTC prediction
  console.log('1. Testing Complete BTC Prediction: "I think BTC will go up in the next two hours."');
  const btcIntent = IntentParserService.parse('I think BTC will go up in the next two hours.');
  console.log('   Parsed intent:', {
    asset: btcIntent.asset,
    direction: btcIntent.direction,
    timeframeLabel: btcIntent.timeframeLabel,
    timeframeSec: btcIntent.timeframeSec,
    isComplete: btcIntent.isComplete,
  });
  if (btcIntent.asset !== 'BTC' || btcIntent.direction !== 'UP' || btcIntent.timeframeSec !== 7200 || !btcIntent.isComplete) {
    throw new Error('BTC Intent parsing failed');
  }
  const btcMatch = await MarketMatcherService.matchIntent(btcIntent);
  console.log('   Market Match Found:', btcMatch.hasMatch);
  console.log('   Summary message:', btcMatch.summaryMessage);
  if (btcMatch.matchedMarket) {
    console.log('   Live Market details:', {
      marketId: btcMatch.matchedMarket.marketId,
      symbol: btcMatch.matchedMarket.symbol,
      asset: btcMatch.matchedMarket.asset,
      strike: btcMatch.matchedMarket.strike,
      isTradable: btcMatch.matchedMarket.isTradable,
      secondsRemaining: btcMatch.matchedMarket.secondsRemaining,
      onchainStatusCode: btcMatch.matchedMarket.onchainStatusCode,
    });
  }

  // Test 2: Full ETH prediction
  console.log('\n2. Testing Complete ETH Prediction: "I think ETH will go down in the next hour."');
  const ethIntent = IntentParserService.parse('I think ETH will go down in the next hour.');
  console.log('   Parsed intent:', {
    asset: ethIntent.asset,
    direction: ethIntent.direction,
    timeframeLabel: ethIntent.timeframeLabel,
    timeframeSec: ethIntent.timeframeSec,
    isComplete: ethIntent.isComplete,
  });
  if (ethIntent.asset !== 'ETH' || ethIntent.direction !== 'DOWN' || ethIntent.timeframeSec !== 3600 || !ethIntent.isComplete) {
    throw new Error('ETH Intent parsing failed');
  }
  const ethMatch = await MarketMatcherService.matchIntent(ethIntent);
  console.log('   Market Match Found:', ethMatch.hasMatch);
  console.log('   Summary message:', ethMatch.summaryMessage);
  if (ethMatch.matchedMarket) {
    console.log('   Live Market details:', {
      marketId: ethMatch.matchedMarket.marketId,
      symbol: ethMatch.matchedMarket.symbol,
      asset: ethMatch.matchedMarket.asset,
      strike: ethMatch.matchedMarket.strike,
      isTradable: ethMatch.matchedMarket.isTradable,
      secondsRemaining: ethMatch.matchedMarket.secondsRemaining,
      onchainStatusCode: ethMatch.matchedMarket.onchainStatusCode,
    });
  }

  // Test 3: Clarification Flow - Step 1: Missing Asset ("I think it will go up.")
  console.log('\n3. Testing Incomplete Intent: "I think it will go up." (Missing Asset)');
  const clarify1 = IntentParserService.parse('I think it will go up.');
  console.log('   Parsed:', {
    asset: clarify1.asset,
    direction: clarify1.direction,
    isComplete: clarify1.isComplete,
    clarificationPrompt: clarify1.clarificationPrompt,
  });
  if (clarify1.isComplete || !clarify1.clarificationPrompt?.includes('BTC or ETH')) {
    throw new Error('Missing asset clarification failed');
  }

  // Test 3: Clarification Flow - Step 2: User provides Asset ("BTC")
  console.log('\n4. Testing Multi-turn continuation: User replies "BTC"');
  const contextStep1 = {
    asset: clarify1.asset,
    direction: clarify1.direction,
    timeframeSec: clarify1.timeframeSec,
    timeframeLabel: clarify1.timeframeLabel,
  };
  const clarify2 = IntentParserService.parse('BTC', contextStep1);
  console.log('   Parsed after merging context:', {
    asset: clarify2.asset,
    direction: clarify2.direction,
    timeframeSec: clarify2.timeframeSec,
    isComplete: clarify2.isComplete,
    clarificationPrompt: clarify2.clarificationPrompt,
  });
  if (clarify2.asset !== 'BTC' || clarify2.direction !== 'UP' || clarify2.isComplete || !clarify2.clarificationPrompt?.includes('timeframe')) {
    throw new Error('Multi-turn asset resolution failed');
  }

  // Test 3: Clarification Flow - Step 3: User provides Timeframe ("Two hours.")
  console.log('\n5. Testing Multi-turn completion: User replies "Two hours."');
  const contextStep2 = {
    asset: clarify2.asset,
    direction: clarify2.direction,
    timeframeSec: clarify2.timeframeSec,
    timeframeLabel: clarify2.timeframeLabel,
  };
  const clarify3 = IntentParserService.parse('Two hours.', contextStep2);
  console.log('   Parsed after completing all slots:', {
    asset: clarify3.asset,
    direction: clarify3.direction,
    timeframeSec: clarify3.timeframeSec,
    timeframeLabel: clarify3.timeframeLabel,
    isComplete: clarify3.isComplete,
  });
  if (!clarify3.isComplete || clarify3.asset !== 'BTC' || clarify3.direction !== 'UP' || clarify3.timeframeSec !== 7200) {
    throw new Error('Multi-turn completion failed');
  }

  // Test 4: Live Market Discovery verification
  console.log('\n6. Testing Direct Live Market Discovery from Somnia Shannon Testnet');
  const allMarkets = await MarketDiscoveryService.discoverMarkets({}, 20);
  console.log(`   Total Discovered Markets on Shannon: ${allMarkets.length}`);
  const tradable = allMarkets.filter(m => m.isTradable);
  console.log(`   Tradable on-chain markets: ${tradable.length}`);
  if (allMarkets.length > 0) {
    const sample = allMarkets[0];
    console.log('   Sample Market Record:', {
      marketId: sample.marketId,
      symbol: sample.symbol,
      asset: sample.asset,
      strike: sample.strike,
      intervalSec: sample.intervalSec,
      onchainStatus: sample.statusLabel,
      onchainStatusCode: sample.onchainStatusCode,
      isTradable: sample.isTradable,
    });
  }

  console.log('\n=== ALL CONVERSATIONAL PREDICTION FLOW TESTS PASSED ===');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
