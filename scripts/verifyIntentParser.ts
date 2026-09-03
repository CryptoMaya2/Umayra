import { IntentParserService } from '../src/services/intentParserService';
import { MarketMatcherService } from '../src/services/marketMatcherService';

async function testIntentFlow() {
  console.log('=== DreamDEX Intent Parser & Market Matcher Test ===\n');

  const testPhrases = [
    "I think BTC will go up in the next two hours.",
    "ETH is going to drop in 15 mins",
    "Bitcoin will pump soon",
    "I think the market will go up",          // missing asset
    "What is happening with ETH?",            // missing direction
    "BTC and ETH are both going up",          // ambiguous asset
  ];

  for (const phrase of testPhrases) {
    console.log(`Input Text: "${phrase}"`);
    const intent = IntentParserService.parse(phrase);
    console.log(`-> Parsed Intent:`, {
      asset: intent.asset,
      direction: intent.direction,
      timeframeLabel: intent.timeframeLabel,
      timeframeSec: intent.timeframeSec,
      isComplete: intent.isComplete,
      clarificationPrompt: intent.clarificationPrompt,
    });

    if (intent.isComplete) {
      console.log(`-> Matching against live Shannon testnet markets...`);
      const match = await MarketMatcherService.matchIntent(intent);
      console.log(`-> Match Result:`, {
        hasMatch: match.hasMatch,
        summary: match.summaryMessage,
        matchedSymbol: match.matchedMarket?.symbol,
        matchedStrike: match.matchedMarket?.strike,
        isTradable: match.matchedMarket?.isTradable,
      });
    }
    console.log('------------------------------------------------------------\n');
  }

  console.log('=== All Intent Tests Completed Successfully ===');
  process.exit(0);
}

testIntentFlow().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
