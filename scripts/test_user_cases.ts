import { IntentParserService } from '../src/services/intentParserService';
import { MarketMatcherService } from '../src/services/marketMatcherService';

async function runPromptTests() {
  const prompts = [
    "I think BTC will go up in the next two hours.",
    "I think ETH will go down in the next hour.",
    "I want BTC to go up.",
    "I think SOL will go up in the next hour.",
  ];

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    console.log(`\n============================================================`);
    console.log(`TEST #${i + 1}: "${p}"`);
    console.log(`============================================================`);
    
    const intent = IntentParserService.parse(p);
    console.log(`Parsed Intent:`, {
      asset: intent.asset,
      direction: intent.direction,
      timeframeLabel: intent.timeframeLabel,
      timeframeSec: intent.timeframeSec,
      isComplete: intent.isComplete,
      missingFields: intent.missingFields,
      clarificationPrompt: intent.clarificationPrompt,
    });

    if (intent.isComplete) {
      console.log(`\nExecuting Live Shannon Testnet Market Match...`);
      const match = await MarketMatcherService.matchIntent(intent);
      console.log(`Live Market Found: ${match.hasMatch}`);
      console.log(`Summary Message: "${match.summaryMessage}"`);
      if (match.matchedMarket) {
        console.log(`Selected Market:`, {
          marketId: match.matchedMarket.marketId,
          symbol: match.matchedMarket.symbol,
          asset: match.matchedMarket.asset,
          strike: match.matchedMarket.strike,
          expiry: match.matchedMarket.expiryDateString,
          secondsRemaining: match.matchedMarket.secondsRemaining,
          onchainStatus: `Code ${match.matchedMarket.onchainStatusCode} (${match.matchedMarket.statusLabel})`,
          isTradable: match.matchedMarket.isTradable,
        });
      }
    } else {
      console.log(`\nHandling of Ambiguity / Unsupported Asset:`);
      console.log(`Clarification Output: "${intent.clarificationPrompt}"`);
    }
  }

  process.exit(0);
}

runPromptTests().catch(console.error);
