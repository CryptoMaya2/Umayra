import { IntentParserService } from '../src/services/intentParserService';
import { MarketMatcherService } from '../src/services/marketMatcherService';
import type { ParsedMarketIntent } from '../src/types/intent';

async function runClarificationTests() {
  console.log('============================================================');
  console.log('DREAMDEX MULTI-TURN CONVERSATIONAL INTENT TEST SUITE');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // FLOW 1 & 2: Incomplete timeframe -> Multi-turn clarification
  // ------------------------------------------------------------
  console.log('--- FLOW 1: Incomplete Intent (Missing Timeframe) ---');
  const userMsg1 = "I want BTC to go up.";
  console.log(`User: "${userMsg1}"`);
  
  const intent1 = IntentParserService.parse(userMsg1);
  console.log(`Parsed Intent 1:`, {
    asset: intent1.asset,
    direction: intent1.direction,
    timeframeSec: intent1.timeframeSec,
    timeframeLabel: intent1.timeframeLabel,
    isComplete: intent1.isComplete,
    missingFields: intent1.missingFields,
    clarificationPrompt: intent1.clarificationPrompt,
  });

  console.log(`Assistant response: "${intent1.clarificationPrompt}"\n`);

  console.log('--- FLOW 2: Follow-up Timeframe Clarification ---');
  const userMsg2 = "Two hours.";
  console.log(`User: "${userMsg2}"`);

  // Combines with previous context from intent1
  const pendingContext: Partial<ParsedMarketIntent> = {
    asset: intent1.asset,
    direction: intent1.direction,
    timeframeSec: intent1.timeframeSec,
    timeframeLabel: intent1.timeframeLabel,
  };

  const intent2 = IntentParserService.parse(userMsg2, pendingContext);
  console.log(`Combined Intent 2:`, {
    asset: intent2.asset,
    direction: intent2.direction,
    timeframeSec: intent2.timeframeSec,
    timeframeLabel: intent2.timeframeLabel,
    isComplete: intent2.isComplete,
    missingFields: intent2.missingFields,
    clarificationPrompt: intent2.clarificationPrompt,
  });

  if (intent2.isComplete) {
    console.log(`Matching combined intent against live Shannon testnet...`);
    const match2 = await MarketMatcherService.matchIntent(intent2);
    console.log(`Match Found: ${match2.hasMatch}`);
    console.log(`Assistant Response: "${match2.summaryMessage}"`);
    if (match2.matchedMarket) {
      console.log(`Matched Market: ${match2.matchedMarket.symbol} (ID: ${match2.matchedMarket.marketId})`);
      console.log(`On-Chain Status: Code ${match2.matchedMarket.onchainStatusCode} (Trading: ${match2.matchedMarket.isTradable})`);
    }
  }
  console.log('\n------------------------------------------------------------\n');

  // ------------------------------------------------------------
  // FLOW 3: Complete single-turn intent
  // ------------------------------------------------------------
  console.log('--- FLOW 3: Complete Single-Turn Intent ---');
  const userMsg3 = "I think ETH will go down in the next hour.";
  console.log(`User: "${userMsg3}"`);

  const intent3 = IntentParserService.parse(userMsg3);
  console.log(`Parsed Intent 3:`, {
    asset: intent3.asset,
    direction: intent3.direction,
    timeframeSec: intent3.timeframeSec,
    timeframeLabel: intent3.timeframeLabel,
    isComplete: intent3.isComplete,
    missingFields: intent3.missingFields,
  });

  if (intent3.isComplete) {
    console.log(`Matching intent against live Shannon testnet...`);
    const match3 = await MarketMatcherService.matchIntent(intent3);
    console.log(`Match Found: ${match3.hasMatch}`);
    console.log(`Assistant Response: "${match3.summaryMessage}"`);
    if (match3.matchedMarket) {
      console.log(`Matched Market: ${match3.matchedMarket.symbol} (ID: ${match3.matchedMarket.marketId})`);
    }
  }
  console.log('\n------------------------------------------------------------\n');

  // ------------------------------------------------------------
  // FLOW 4: Unsupported Asset
  // ------------------------------------------------------------
  console.log('--- FLOW 4: Unsupported Asset Handling ---');
  const userMsg4 = "I want SOL to go up.";
  console.log(`User: "${userMsg4}"`);

  const intent4 = IntentParserService.parse(userMsg4);
  console.log(`Parsed Intent 4:`, {
    asset: intent4.asset,
    unsupportedAsset: intent4.unsupportedAsset,
    direction: intent4.direction,
    isComplete: intent4.isComplete,
    missingFields: intent4.missingFields,
    clarificationPrompt: intent4.clarificationPrompt,
  });
  console.log(`Assistant Response: "${intent4.clarificationPrompt}"`);
  console.log('\n============================================================');
  console.log('TEST SUITE COMPLETED SUCCESSFULLY');
  console.log('============================================================');

  process.exit(0);
}

runClarificationTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
