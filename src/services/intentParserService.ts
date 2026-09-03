import type { 
  ParsedMarketIntent, 
  IntentAsset, 
  IntentDirection, 
  SelectedMarketContext 
} from '../types/intent';

const SINGLE_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS_NUMBERS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const NUMBER_WORDS: Record<string, number> = {
  ...SINGLE_NUMBERS,
  ...TENS_NUMBERS,
};

const COMMON_UNSUPPORTED_ASSETS = [
  'sol', 'solana', 'doge', 'dogecoin', 'xrp', 'ripple', 'avax', 'avalanche',
  'bnb', 'binance', 'ada', 'cardano', 'dot', 'polkadot', 'matic', 'polygon',
  'sui', 'aptos', 'ton', 'near', 'link', 'chainlink', 'shib', 'pepe', 'tron', 'trx'
];

export class IntentParserService {
  /**
   * Helper to parse a natural language sequence of number words (e.g. "twenty five", "ten", "one hundred") into a number.
   */
  public static parseNumberWordSequence(str: string): number | null {
    const cleaned = str.toLowerCase().replace(/['’]/g, '').replace(/[-_]/g, ' ').trim();
    if (!cleaned) return null;

    // Check if it's already a direct numerical string
    if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }

    const tokens = cleaned.split(/\s+/);
    let total = 0;
    let currentGroup = 0;
    let foundAny = false;

    for (const token of tokens) {
      if (SINGLE_NUMBERS[token] !== undefined) {
        currentGroup += SINGLE_NUMBERS[token];
        foundAny = true;
      } else if (TENS_NUMBERS[token] !== undefined) {
        currentGroup += TENS_NUMBERS[token];
        foundAny = true;
      } else if (token === 'hundred') {
        currentGroup = currentGroup === 0 ? 100 : currentGroup * 100;
        foundAny = true;
      } else if (token === 'thousand') {
        currentGroup = currentGroup === 0 ? 1000 : currentGroup * 1000;
        total += currentGroup;
        currentGroup = 0;
        foundAny = true;
      } else if (token === 'and') {
        continue;
      } else {
        return null;
      }
    }

    if (!foundAny) return null;
    return total + currentGroup;
  }

  /**
   * Extracts a trade amount and currency specification from natural language text.
   */
  public static extractTradeAmount(text: string): {
    amount: number | null;
    hasCurrencyUnit: boolean;
    hasNumberWithoutUnit: boolean;
    isInvalidOrNegative: boolean;
  } {
    const normalized = text.toLowerCase().replace(/[’]/g, "'").trim();

    // 1. Check for negative / minus amounts (e.g. "-$5", "-10", "minus ten dollars")
    if (/-\s*\$?\d+/.test(normalized) || /\b(?:negative|minus)\s+\$?\d+/i.test(normalized) || /\b(?:negative|minus)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|hundred)/i.test(normalized)) {
      return {
        amount: null,
        hasCurrencyUnit: true,
        hasNumberWithoutUnit: false,
        isInvalidOrNegative: true,
      };
    }

    // 2. Explicit currency symbol + digits: e.g. "$10", "$ 10.50", "$25", "$5"
    const dollarSymbolMatch = normalized.match(/\$\s*(\d+(?:\.\d+)?)\b/i);
    if (dollarSymbolMatch) {
      const amt = parseFloat(dollarSymbolMatch[1]);
      if (isNaN(amt) || amt <= 0) {
        return { amount: null, hasCurrencyUnit: true, hasNumberWithoutUnit: false, isInvalidOrNegative: true };
      }
      return { amount: amt, hasCurrencyUnit: true, hasNumberWithoutUnit: false, isInvalidOrNegative: false };
    }

    // 3. Digits + currency word: e.g. "10 dollars", "10 dollar", "25 usdc", "10 bucks", "10$"
    const digitsCurrencyMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:dollars?|usdc|bucks?|\$)\b/i);
    if (digitsCurrencyMatch) {
      const amt = parseFloat(digitsCurrencyMatch[1]);
      if (isNaN(amt) || amt <= 0) {
        return { amount: null, hasCurrencyUnit: true, hasNumberWithoutUnit: false, isInvalidOrNegative: true };
      }
      return { amount: amt, hasCurrencyUnit: true, hasNumberWithoutUnit: false, isInvalidOrNegative: false };
    }

    // 4. Number words + currency word: e.g. "ten dollars", "twenty five dollars", "twenty-five dollars", "five usdc", "one hundred bucks"
    const numberWordPattern = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and|\\s|-)+';
    const wordCurrencyRegex = new RegExp(`\\b(${numberWordPattern})\\s*(?:dollars?|usdc|bucks?)\\b`, 'i');
    const wordCurrencyMatch = normalized.match(wordCurrencyRegex);
    if (wordCurrencyMatch) {
      const numStr = wordCurrencyMatch[1].trim();
      const parsedNum = this.parseNumberWordSequence(numStr);
      if (parsedNum !== null) {
        if (parsedNum <= 0) {
          return { amount: null, hasCurrencyUnit: true, hasNumberWithoutUnit: false, isInvalidOrNegative: true };
        }
        return { amount: parsedNum, hasCurrencyUnit: true, hasNumberWithoutUnit: false, isInvalidOrNegative: false };
      }
    }

    // 5. Look for numbers without currency unit in follow-up context (e.g. "Take it with ten", "with 10", "put 10 on it", "buy 25", "for 10", "do it with ten")
    const withDigitsMatch = normalized.match(/(?:with|for|put|buy|do|take|trade|it\s+with|on\s+this|on\s+it)\s+(?:a\s+)?(\d+(?:\.\d+)?)\b/i);
    if (withDigitsMatch) {
      const parsedNum = parseFloat(withDigitsMatch[1]);
      if (!isNaN(parsedNum)) {
        if (parsedNum <= 0) {
          return { amount: null, hasCurrencyUnit: false, hasNumberWithoutUnit: true, isInvalidOrNegative: true };
        }
        return { amount: parsedNum, hasCurrencyUnit: false, hasNumberWithoutUnit: true, isInvalidOrNegative: false };
      }
    }

    const withWordsRegex = new RegExp(`(?:with|for|put|buy|do|take|trade|it\\s+with|on\\s+this|on\\s+it)\\s+(?:a\\s+)?(${numberWordPattern})\\b`, 'i');
    const withWordsMatch = normalized.match(withWordsRegex);
    if (withWordsMatch) {
      const candidateStr = withWordsMatch[1].trim();
      const parsedNum = this.parseNumberWordSequence(candidateStr);
      if (parsedNum !== null) {
        if (parsedNum <= 0) {
          return { amount: null, hasCurrencyUnit: false, hasNumberWithoutUnit: true, isInvalidOrNegative: true };
        }
        return { amount: parsedNum, hasCurrencyUnit: false, hasNumberWithoutUnit: true, isInvalidOrNegative: false };
      }
    }

    // 6. Check if the message is simply a standalone number word or raw digits without currency (e.g. "10", "ten", "twenty five")
    const standaloneNum = this.parseNumberWordSequence(normalized);
    if (standaloneNum !== null) {
      if (standaloneNum <= 0) {
        return { amount: null, hasCurrencyUnit: false, hasNumberWithoutUnit: true, isInvalidOrNegative: true };
      }
      return { amount: standaloneNum, hasCurrencyUnit: false, hasNumberWithoutUnit: true, isInvalidOrNegative: false };
    }

    // No amount or numbers detected
    return {
      amount: null,
      hasCurrencyUnit: false,
      hasNumberWithoutUnit: false,
      isInvalidOrNegative: false,
    };
  }

  /**
   * Deterministically parses a natural language user prediction or follow-up trade intention into a structured object,
   * merging with previously accumulated context or selected market context.
   */
  public static parse(
    input: string, 
    previousContext?: Partial<ParsedMarketIntent> | null,
    selectedMarketContext?: SelectedMarketContext | null
  ): ParsedMarketIntent {
    const rawText = input.trim();
    const text = rawText.toLowerCase().replace(/[’]/g, "'");

    // 1. Detect if this is an explicit NEW prediction (e.g. user mentions asset or explicit prediction formula)
    const hasBtc = /\b(btc|bitcoin|sats|satoshi)\b/i.test(text);
    const hasEth = /\b(eth|ethereum|ether)\b/i.test(text);

    let unsupportedAsset: string | null = null;
    if (!hasBtc && !hasEth) {
      for (const unsupp of COMMON_UNSUPPORTED_ASSETS) {
        const regex = new RegExp(`\\b${unsupp}\\b`, 'i');
        if (regex.test(text)) {
          unsupportedAsset = unsupp.toUpperCase();
          break;
        }
      }
    }

    const hasExplicitNewPredictionVerbs = /\b(i\s+think|i\s+predict|i\s+expect|i\s+believe|i\s+bet|what\s+about|how\s+about|predict)\b/i.test(text);
    const isExplicitNewPrediction = hasBtc || hasEth || !!unsupportedAsset || (hasExplicitNewPredictionVerbs && /\b(up|down|rise|drop|hour|minute|mins)\b/i.test(text));

    // 2. Check for Contextual Follow-Up Trade Command on an Active Selected Market
    if (selectedMarketContext && !isExplicitNewPrediction) {
      const followUpActionKeywords = /\b(take\s+(?:the\s+)?trade|take\s+it|take\s+this|let'?s\s+do|lets\s+do|buy|go\s+ahead|proceed|put\s+.*(?:on\s+this|on\s+it|on)|place\s+(?:the\s+)?trade|place\s+trade|place\s+this|do\s+it|okay\s*,?\s*do\s+it|confirm|trade|invest|execute|i\s+want\s+to\s+put|i\s+want\s+to\s+trade|i\s+want\s+to\s+buy)\b/i;
      const isActionTrigger = followUpActionKeywords.test(text);

      const extractedAmount = this.extractTradeAmount(text);
      const isAmountOnly = extractedAmount.amount !== null || extractedAmount.hasNumberWithoutUnit || extractedAmount.isInvalidOrNegative;

      // If user provided a follow-up action or entered an amount for the active selected market:
      if (isActionTrigger || isAmountOnly) {
        const targetMarket = selectedMarketContext.market;
        const targetDirection = selectedMarketContext.direction;

        // Subcase A: Invalid or negative amount provided
        if (extractedAmount.isInvalidOrNegative) {
          return {
            rawText,
            action: 'PLACE_TRADE',
            asset: targetMarket.asset as IntentAsset,
            direction: targetDirection,
            timeframeSec: targetMarket.secondsRemaining,
            timeframeLabel: targetMarket.expiryDateString,
            tradeAmount: null,
            isComplete: false,
            missingFields: ['tradeAmount'],
            clarificationPrompt: 'Please specify a valid, positive trade amount (e.g., "$10" or "25 dollars").',
            selectedMarket: targetMarket,
          };
        }

        // Subcase B: Ambiguous currency (e.g. "Take it with ten" without $, dollars, or usdc)
        if (extractedAmount.hasNumberWithoutUnit && !extractedAmount.hasCurrencyUnit) {
          return {
            rawText,
            action: 'PLACE_TRADE',
            asset: targetMarket.asset as IntentAsset,
            direction: targetDirection,
            timeframeSec: targetMarket.secondsRemaining,
            timeframeLabel: targetMarket.expiryDateString,
            tradeAmount: null,
            isComplete: false,
            missingFields: ['tradeAmount'],
            clarificationPrompt: 'Please clarify your trade amount in dollars or USDC (e.g., "$10" or "10 dollars").',
            selectedMarket: targetMarket,
          };
        }

        // Subcase C: Action triggered but no amount provided at all (e.g. "Okay, do it", "Take the trade")
        if (extractedAmount.amount === null) {
          return {
            rawText,
            action: 'PLACE_TRADE',
            asset: targetMarket.asset as IntentAsset,
            direction: targetDirection,
            timeframeSec: targetMarket.secondsRemaining,
            timeframeLabel: targetMarket.expiryDateString,
            tradeAmount: null,
            isComplete: false,
            missingFields: ['tradeAmount'],
            clarificationPrompt: 'How much would you like to trade?',
            selectedMarket: targetMarket,
          };
        }

        // Subcase D: Valid amount provided! (e.g. "$10", "ten dollars", "twenty five dollars", "$25", "Let's do $5")
        return {
          rawText,
          action: 'PLACE_TRADE',
          asset: targetMarket.asset as IntentAsset,
          direction: targetDirection,
          timeframeSec: targetMarket.secondsRemaining,
          timeframeLabel: targetMarket.expiryDateString,
          tradeAmount: extractedAmount.amount,
          isComplete: true,
          missingFields: [],
          clarificationPrompt: null,
          selectedMarket: targetMarket,
        };
      }
    }

    // 3. Standard Prediction Intent Parsing (action: 'PREDICT')
    let extractedAsset: IntentAsset | null = null;
    if (hasBtc && !hasEth) {
      extractedAsset = 'BTC';
    } else if (hasEth && !hasBtc) {
      extractedAsset = 'ETH';
    }

    // Detect Direction (UP / DOWN)
    const upKeywords = /\b(up|increase|increases|rising|rise|rises|pump|pumping|pumps|bull|bullish|gain|gains|higher|high|above|green|long|buy\s+yes|yes)\b/i;
    const downKeywords = /\b(down|decrease|decreases|dropping|drop|drops|fall|falling|falls|dump|dumping|dumps|bear|bearish|loss|losses|lower|low|below|red|short|buy\s+no|no)\b/i;

    const hasUp = upKeywords.test(text);
    const hasDown = downKeywords.test(text);

    let extractedDirection: IntentDirection | null = null;
    if (hasUp && !hasDown) {
      extractedDirection = 'UP';
    } else if (hasDown && !hasUp) {
      extractedDirection = 'DOWN';
    }

    // Extract Timeframe
    const { timeframeSec: extractedTimeframeSec, timeframeLabel: extractedTimeframeLabel } = this.extractTimeframe(text);

    // Combine with conversational prediction context if present
    const asset = extractedAsset || (unsupportedAsset ? null : previousContext?.asset) || null;
    const direction = extractedDirection || previousContext?.direction || null;
    const timeframeSec = extractedTimeframeSec !== null 
      ? extractedTimeframeSec 
      : (previousContext?.timeframeSec !== undefined ? previousContext.timeframeSec : null);
    const timeframeLabel = extractedTimeframeLabel !== null 
      ? extractedTimeframeLabel 
      : (previousContext?.timeframeLabel !== undefined ? previousContext.timeframeLabel : null);

    // Determine missing fields and clarification prompts
    const missingFields: ('asset' | 'direction' | 'timeframe' | 'tradeAmount')[] = [];
    if (!asset) missingFields.push('asset');
    if (!direction) missingFields.push('direction');
    if (timeframeSec === null) missingFields.push('timeframe');

    let clarificationPrompt: string | null = null;

    if (unsupportedAsset) {
      clarificationPrompt = `Only **BTC** and **ETH** Event Contracts are currently supported on DreamDEX. Please specify whether you want to predict on **BTC** or **ETH**.`;
    } else if (hasBtc && hasEth) {
      clarificationPrompt = "You mentioned both BTC and ETH. Please specify which asset you want to predict on.";
    } else if (hasUp && hasDown) {
      clarificationPrompt = "You mentioned both upward and downward movement. Please clarify if you expect it to go UP or DOWN.";
    } else if (missingFields.includes('asset') && missingFields.includes('direction')) {
      clarificationPrompt = "I need to know both the asset (BTC or ETH) and direction (UP or DOWN), e.g. \"I think BTC will go UP in the next 15 minutes\".";
    } else if (missingFields.includes('asset')) {
      const dirMove = direction === 'UP' ? 'an upward' : direction === 'DOWN' ? 'a downward' : 'a market';
      clarificationPrompt = `I notice you're predicting ${dirMove} move. Do you mean BTC or ETH?`;
    } else if (missingFields.includes('direction')) {
      clarificationPrompt = `Are you predicting that ${asset} will go UP or DOWN?`;
    } else if (missingFields.includes('timeframe')) {
      clarificationPrompt = "Sure. What timeframe are you thinking — 1 hour, 2 hours, or something else?";
    }

    const isComplete = missingFields.length === 0 && clarificationPrompt === null;

    return {
      rawText,
      action: 'PREDICT',
      asset,
      direction,
      timeframeSec,
      timeframeLabel,
      isComplete,
      missingFields,
      clarificationPrompt,
      unsupportedAsset,
    };
  }

  /**
   * Helper to parse timeframes like "next 2 hours", "two hours", "in 15 mins", "60 seconds", etc.
   */
  private static extractTimeframe(text: string): { timeframeSec: number | null; timeframeLabel: string | null } {
    // Normalize number words (e.g. "two hours" -> "2 hours")
    let normalized = text;
    for (const [word, num] of Object.entries(NUMBER_WORDS)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      normalized = normalized.replace(regex, num.toString());
    }

    // Regex for hours: e.g., "2 hours", "1.5 hrs", "1hr", "next hour", "two hours"
    const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h)\b/i);
    if (hourMatch) {
      const hours = parseFloat(hourMatch[1]);
      const sec = Math.round(hours * 3600);
      return {
        timeframeSec: sec,
        timeframeLabel: `${hours} hour${hours === 1 ? '' : 's'}`,
      };
    }

    if (/\b(?:next|an?|one)\s+(?:hour|hr)\b/i.test(normalized)) {
      return {
        timeframeSec: 3600,
        timeframeLabel: '1 hour',
      };
    }

    // Regex for minutes: e.g., "15 mins", "30 minutes", "5m"
    const minMatch = normalized.match(/(\d+)\s*(?:minutes|minute|mins|min|m)\b/i);
    if (minMatch) {
      const mins = parseInt(minMatch[1], 10);
      return {
        timeframeSec: mins * 60,
        timeframeLabel: `${mins} minute${mins === 1 ? '' : 's'}`,
      };
    }

    // Regex for seconds: e.g., "60 seconds", "45s"
    const secMatch = normalized.match(/(\d+)\s*(?:seconds|second|secs|sec|s)\b/i);
    if (secMatch) {
      const secs = parseInt(secMatch[1], 10);
      return {
        timeframeSec: secs,
        timeframeLabel: `${secs} seconds`,
      };
    }

    // General qualitative terms
    if (/\b(?:soon|shortly|fast|quick|imminently)\b/i.test(normalized)) {
      return {
        timeframeSec: 300, // 5 minutes default for "soon"
        timeframeLabel: 'Soon (~5 mins)',
      };
    }

    if (/\b(?:today|this day|24h|1 day|one day)\b/i.test(normalized)) {
      return {
        timeframeSec: 86400,
        timeframeLabel: 'Today (24 hours)',
      };
    }

    return {
      timeframeSec: null,
      timeframeLabel: null,
    };
  }
}
