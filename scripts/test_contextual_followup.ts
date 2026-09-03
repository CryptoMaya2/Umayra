/**
 * Comprehensive Test Suite for Conversational Contextual Follow-Up Intent Engine
 */
import { IntentParserService } from '../src/services/intentParserService';
import type { NormalizedEventMarket } from '../src/types/market';
import type { SelectedMarketContext } from '../src/types/intent';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

// Mock live BTC and ETH markets for test contexts
const mockBtcMarket: NormalizedEventMarket = {
  marketId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  shortMarketId: '0x1234...cdef',
  symbol: 'BTC-20260903-1300',
  asset: 'BTC',
  strike: 97500,
  intervalSec: 7200,
  timeRemainingFormatted: '1h 58m',
  expiryDateString: '2026-09-03 13:00:00 UTC',
  isExpired: false,
  isResolved: false,
  isVoided: false,
  statusLabel: 'Trading',
  onchainStatusCode: 1,
  secondsRemaining: 7080,
  isTradable: true,
  outcomes: {
    up: { label: 'UP', tokenId: '0xup11111' },
    down: { label: 'DOWN', tokenId: '0xdown1111' }
  }
};

const mockEthMarket: NormalizedEventMarket = {
  marketId: '0xeth1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  shortMarketId: '0xeth1...cdef',
  symbol: 'ETH-20260903-1200',
  asset: 'ETH',
  strike: 3450,
  intervalSec: 3600,
  timeRemainingFormatted: '58m',
  expiryDateString: '2026-09-03 12:00:00 UTC',
  isExpired: false,
  isResolved: false,
  isVoided: false,
  statusLabel: 'Trading',
  onchainStatusCode: 1,
  secondsRemaining: 3480,
  isTradable: true,
  outcomes: {
    up: { label: 'UP', tokenId: '0xup22222' },
    down: { label: 'DOWN', tokenId: '0xdown2222' }
  }
};

const btcUpContext: SelectedMarketContext = {
  market: mockBtcMarket,
  direction: 'UP'
};

const ethDownContext: SelectedMarketContext = {
  market: mockEthMarket,
  direction: 'DOWN'
};

async function runContextualTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  UMAYRA CONTEXTUAL FOLLOW-UP INTENT ENGINE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // -------------------------------------------------------------
  // Test 1: Flow 1 - BTC prediction followed by "Take the trade with ten dollars."
  // -------------------------------------------------------------
  console.log('Test 1: Flow 1 — "I think BTC will go up in the next two hours." -> "Take the trade with ten dollars."');
  const intent1a = IntentParserService.parse('I think BTC will go up in the next two hours.');
  assert(intent1a.action === 'PREDICT', 'Initial intent must be PREDICT');
  assert(intent1a.asset === 'BTC', 'Asset must be BTC');
  assert(intent1a.direction === 'UP', 'Direction must be UP');
  assert(intent1a.timeframeSec === 7200, 'Timeframe must be 7200');
  assert(intent1a.isComplete === true, 'Initial intent must be complete');
  console.log('  ✓ Step 1a parsed correctly');

  const intent1b = IntentParserService.parse('Take the trade with ten dollars.', null, btcUpContext);
  assert(intent1b.action === 'PLACE_TRADE', 'Follow up must be PLACE_TRADE');
  assert(intent1b.tradeAmount === 10, 'Trade amount must be 10');
  assert(intent1b.asset === 'BTC', 'Asset must be preserved as BTC');
  assert(intent1b.direction === 'UP', 'Direction must be preserved as UP');
  assert(intent1b.isComplete === true, 'Trade follow-up with amount must be complete');
  assert(intent1b.selectedMarket?.marketId === mockBtcMarket.marketId, 'Selected market must be preserved');
  console.log('  ✓ Step 1b: $10 attached to selected BTC UP market\n');

  // -------------------------------------------------------------
  // Test 2: Flow 2 - ETH prediction followed by "Let's do $5."
  // -------------------------------------------------------------
  console.log('Test 2: Flow 2 — "I think ETH will go down in the next hour." -> "Let\'s do $5."');
  const intent2a = IntentParserService.parse('I think ETH will go down in the next hour.');
  assert(intent2a.action === 'PREDICT', 'Initial intent must be PREDICT');
  assert(intent2a.asset === 'ETH', 'Asset must be ETH');
  assert(intent2a.direction === 'DOWN', 'Direction must be DOWN');
  assert(intent2a.timeframeSec === 3600, 'Timeframe must be 3600');
  console.log('  ✓ Step 2a parsed correctly');

  const intent2b = IntentParserService.parse("Let's do $5.", null, ethDownContext);
  assert(intent2b.action === 'PLACE_TRADE', 'Follow up must be PLACE_TRADE');
  assert(intent2b.tradeAmount === 5, 'Trade amount must be 5');
  assert(intent2b.asset === 'ETH', 'Asset must be preserved as ETH');
  assert(intent2b.direction === 'DOWN', 'Direction must be preserved as DOWN');
  assert(intent2b.isComplete === true, 'Trade follow up with $5 must be complete');
  console.log('  ✓ Step 2b: $5 attached to selected ETH DOWN market\n');

  // -------------------------------------------------------------
  // Test 3: Flow 3 - Clarification flow ("I think BTC will go up.")
  // -------------------------------------------------------------
  console.log('Test 3: Flow 3 — "I think BTC will go up." (missing timeframe)');
  const intent3 = IntentParserService.parse('I think BTC will go up.');
  assert(intent3.action === 'PREDICT', 'Action must be PREDICT');
  assert(intent3.asset === 'BTC', 'Asset must be BTC');
  assert(intent3.direction === 'UP', 'Direction must be UP');
  assert(intent3.timeframeSec === null, 'Timeframe must be null');
  assert(intent3.isComplete === false, 'Intent without timeframe must be incomplete');
  assert(intent3.clarificationPrompt !== null, 'Clarification prompt must exist');
  console.log('  ✓ Clarification prompt triggered:', intent3.clarificationPrompt, '\n');

  // -------------------------------------------------------------
  // Test 4: Flow 4 - After market selection: "Okay, do it." -> asks for amount
  // -------------------------------------------------------------
  console.log('Test 4: Flow 4 — After market selection: "Okay, do it." (No amount provided)');
  const intent4 = IntentParserService.parse('Okay, do it.', null, btcUpContext);
  assert(intent4.action === 'PLACE_TRADE', 'Action must be PLACE_TRADE');
  assert(intent4.tradeAmount === null, 'Trade amount must be null');
  assert(intent4.isComplete === false, 'Intent must be incomplete when amount is missing');
  assert(intent4.clarificationPrompt === 'How much would you like to trade?', 'Must prompt: How much would you like to trade?');
  console.log('  ✓ Correctly prompted for amount without inventing any amount:', intent4.clarificationPrompt, '\n');

  // -------------------------------------------------------------
  // Test 5: Flow 5 - After market selection: "I want to put $10 on this."
  // -------------------------------------------------------------
  console.log('Test 5: Flow 5 — After market selection: "I want to put $10 on this."');
  const intent5 = IntentParserService.parse('I want to put $10 on this.', null, btcUpContext);
  assert(intent5.action === 'PLACE_TRADE', 'Action must be PLACE_TRADE');
  assert(intent5.tradeAmount === 10, 'Trade amount must be 10');
  assert(intent5.asset === 'BTC', 'Asset must be BTC');
  assert(intent5.direction === 'UP', 'Direction must be UP');
  assert(intent5.isComplete === true, 'Intent must be complete');
  console.log('  ✓ $10 successfully attached\n');

  // -------------------------------------------------------------
  // Test 6: Natural follow-up variations
  // -------------------------------------------------------------
  console.log('Test 6: Natural Follow-up Variations');
  const variations = [
    { text: 'Take it with $10.', expectedAmt: 10 },
    { text: "Let's do $10.", expectedAmt: 10 },
    { text: 'Let’s do $10.', expectedAmt: 10 }, // smart quote
    { text: 'Buy $10.', expectedAmt: 10 },
    { text: 'Go ahead with ten dollars.', expectedAmt: 10 },
    { text: 'I want to put ten dollars on this.', expectedAmt: 10 },
    { text: 'Place the trade for $10.', expectedAmt: 10 },
    { text: 'twenty five dollars', expectedAmt: 25 },
    { text: '$25', expectedAmt: 25 },
    { text: 'twenty-five dollars', expectedAmt: 25 },
    { text: 'Put 50 USDC on this', expectedAmt: 50 },
    { text: 'Let’s do 100 dollars', expectedAmt: 100 },
  ];

  for (const v of variations) {
    const res = IntentParserService.parse(v.text, null, btcUpContext);
    assert(res.action === 'PLACE_TRADE', `"${v.text}" must be PLACE_TRADE`);
    assert(res.tradeAmount === v.expectedAmt, `"${v.text}" must parse amount ${v.expectedAmt}, got ${res.tradeAmount}`);
    assert(res.isComplete === true, `"${v.text}" must be complete`);
    console.log(`  ✓ "${v.text}" -> $${res.tradeAmount} USDC on BTC UP`);
  }
  console.log();

  // -------------------------------------------------------------
  // Test 7: Ambiguous currency handling ("Take it with ten.")
  // -------------------------------------------------------------
  console.log('Test 7: Ambiguous currency — "Take it with ten." (no $, dollars, or usdc)');
  const intent7 = IntentParserService.parse('Take it with ten.', null, btcUpContext);
  assert(intent7.action === 'PLACE_TRADE', 'Action must be PLACE_TRADE');
  assert(intent7.isComplete === false, 'Ambiguous currency must be incomplete');
  assert(intent7.clarificationPrompt?.includes('dollars or USDC') === true, 'Must ask for dollar/USDC clarification');
  console.log('  ✓ Ambiguous currency prompted for clarification:', intent7.clarificationPrompt, '\n');

  // -------------------------------------------------------------
  // Test 8: Invalid / negative / zero amounts
  // -------------------------------------------------------------
  console.log('Test 8: Invalid / zero / negative amounts');
  const invalidCases = [
    'Take it with 0 dollars.',
    'Put -$5 on this.',
    'Let’s do minus ten dollars.',
    'Trade $0'
  ];

  for (const ic of invalidCases) {
    const res = IntentParserService.parse(ic, null, btcUpContext);
    assert(res.isComplete === false, `"${ic}" must NOT be complete`);
    assert(res.clarificationPrompt?.includes('positive trade amount') === true, `"${ic}" must prompt for valid positive amount`);
    console.log(`  ✓ "${ic}" -> properly rejected: ${res.clarificationPrompt}`);
  }
  console.log();

  // -------------------------------------------------------------
  // Test 9: Context switching — New prediction while market is selected
  // -------------------------------------------------------------
  console.log('Test 9: Context switching — User submits new prediction while BTC is selected');
  const switchIntent = IntentParserService.parse('I think ETH will go down in the next hour.', null, btcUpContext);
  assert(switchIntent.action === 'PREDICT', 'New explicit prediction must take precedence with action PREDICT');
  assert(switchIntent.asset === 'ETH', 'Asset must be ETH, not previous BTC');
  assert(switchIntent.direction === 'DOWN', 'Direction must be DOWN, not previous UP');
  assert(switchIntent.timeframeSec === 3600, 'Timeframe must be 3600');
  assert(switchIntent.isComplete === true, 'New prediction must be complete');
  console.log('  ✓ Fresh prediction successfully overrides previous selected market\n');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  ALL CONTEXTUAL FOLLOW-UP INTENT TESTS PASSED (100%)');
  console.log('═══════════════════════════════════════════════════════════════════');
}

runContextualTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
