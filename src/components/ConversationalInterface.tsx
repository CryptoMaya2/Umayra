import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Clock, 
  AlertCircle, 
  HelpCircle, 
  RotateCcw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio
} from 'lucide-react';
import { IntentParserService } from '../services/intentParserService';
import { MarketMatcherService } from '../services/marketMatcherService';
import { useVoiceInteraction } from '../hooks/useVoiceInteraction';
import { TradeReviewCard } from './TradeReviewCard';
import type { ChatMessage, ParsedMarketIntent, SelectedMarketContext } from '../types/intent';

const SAMPLE_PROMPTS = [
  "I think BTC will go up in the next two hours.",
  "I think ETH will go down in the next hour.",
  "I think it will go up.",
  "I want BTC to go up.",
  "Two hours.",
];

export const ConversationalInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      timestamp: new Date(),
      text: "What do you think will happen?\n\nSpeak or type a prediction — for example: *\"I think BTC will go up in the next two hours\"* — and I will find the live on-chain Event Contract matching your view.",
      status: 'success',
    }
  ]);

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingContext, setPendingContext] = useState<Partial<ParsedMarketIntent> | null>(null);
  const [activeMarketContext, setActiveMarketContext] = useState<SelectedMarketContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    liveTranscript,
    speechError,
    isSpeechSupported,
    isTtsSupported,
    isTtsEnabled,
    isSpeaking,
    toggleListening,
    speak,
    stopSpeaking,
    toggleTts,
    clearError,
  } = useVoiceInteraction({ autoTtsDefault: true });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing, liveTranscript]);

  const handleSubmit = async (textToSend?: string, isVoiceInput: boolean = false) => {
    const rawText = (textToSend || input).trim();
    if (!rawText || isProcessing) return;

    setInput('');
    stopSpeaking();
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    // 1. Add User message
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      timestamp: new Date(),
      text: rawText,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // 2. Parse text intent deterministically, passing both partial pending context and active selected market context
      const intent = IntentParserService.parse(rawText, pendingContext, activeMarketContext);

      // 3. Handle Contextual Follow-up Trade Action on Active Market
      if (intent.action === 'PLACE_TRADE' && activeMarketContext) {
        if (!intent.isComplete) {
          const replyText = intent.clarificationPrompt || "How much would you like to trade?";
          const clarificationMessage: ChatMessage = {
            id: assistantMsgId,
            sender: 'assistant',
            timestamp: new Date(),
            text: replyText,
            intent,
            status: 'clarification',
          };
          setMessages(prev => [...prev, clarificationMessage]);
          if (isVoiceInput) {
            speak(replyText);
          }
          setIsProcessing(false);
          return;
        }

        // Complete PLACE_TRADE with valid amount
        const tradeAmount = intent.tradeAmount || 10;
        const targetMarket = activeMarketContext.market;
        const targetDirection = activeMarketContext.direction;

        const confirmIntro = `I've configured your position for **$${tradeAmount} USDC** on **${targetMarket.asset} ${targetDirection}** (${targetMarket.symbol}).\n\nReview your position details below and confirm when you're ready.`;

        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          sender: 'assistant',
          timestamp: new Date(),
          text: confirmIntro,
          intent,
          matchedMarket: targetMarket,
          initialTradeAmount: tradeAmount,
          initialReviewOpen: true,
          status: 'success',
        };

        setActiveMarketContext({
          market: targetMarket,
          direction: targetDirection,
          tradeAmount,
        });

        setMessages(prev => [...prev, assistantMessage]);
        if (isVoiceInput) {
          speak(`I've configured your position for $${tradeAmount} USDC on ${targetMarket.asset} ${targetDirection}. Please review and confirm your trade.`);
        }
        setIsProcessing(false);
        return;
      }

      // 4. Handle standard PREDICT action (incomplete or clarification cases)
      if (!intent.isComplete) {
        // Save partial state to context for multi-turn prediction completion
        if (intent.asset || intent.direction || intent.timeframeSec !== null) {
          setPendingContext({
            asset: intent.asset,
            direction: intent.direction,
            timeframeSec: intent.timeframeSec,
            timeframeLabel: intent.timeframeLabel,
          });
        }

        const replyText = intent.clarificationPrompt || "I couldn't quite understand your market intention. Please specify both the asset (BTC or ETH) and direction (UP or DOWN).";
        const clarificationMessage: ChatMessage = {
          id: assistantMsgId,
          sender: 'assistant',
          timestamp: new Date(),
          text: replyText,
          intent,
          status: 'clarification',
        };
        setMessages(prev => [...prev, clarificationMessage]);
        if (isVoiceInput) {
          speak(replyText);
        }
        setIsProcessing(false);
        return;
      }

      // Complete prediction intent: reset pending context
      setPendingContext(null);

      // 5. Match against live read-only Market Discovery layer
      const matchResult = await MarketMatcherService.matchIntent(intent);

      if (matchResult.hasMatch && matchResult.matchedMarket) {
        setActiveMarketContext({
          market: matchResult.matchedMarket,
          direction: intent.direction!,
        });
      } else {
        setActiveMarketContext(null);
      }

      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        sender: 'assistant',
        timestamp: new Date(),
        text: matchResult.summaryMessage,
        intent,
        matchedMarket: matchResult.matchedMarket,
        candidateMarkets: matchResult.candidateMarkets,
        status: matchResult.hasMatch ? 'success' : 'no_market_found',
      };

      setMessages(prev => [...prev, assistantMessage]);
      if (isVoiceInput) {
        speak(matchResult.summaryMessage);
      }
    } catch (err: any) {
      const errMsg = `An error occurred while evaluating your prediction: ${err?.message || err}`;
      const errorMessage: ChatMessage = {
        id: assistantMsgId,
        sender: 'assistant',
        timestamp: new Date(),
        text: errMsg,
        status: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
      if (isVoiceInput) {
        speak(errMsg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicClick = () => {
    toggleListening((spokenTranscript) => {
      if (spokenTranscript) {
        handleSubmit(spokenTranscript, true);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(undefined, false);
    }
  };

  const clearChat = () => {
    setPendingContext(null);
    setActiveMarketContext(null);
    stopSpeaking();
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        timestamp: new Date(),
        text: "Cleared. What's your next prediction?",
        status: 'success',
      }
    ]);
  };

  return (
    <div className="umayra-chat">

      {/* Identity / Header bar */}
      <div className="chat-identity-bar">
        <div className="chat-identity-left">
          <div className="chat-identity-avatar" aria-hidden="true">
            <Bot size={16} />
          </div>
          <div>
            <div className="chat-identity-name">Umayra</div>
            <div className="chat-identity-sub">Spoken + Typed · Conversational Prediction</div>
          </div>
        </div>

        <div className="chat-identity-actions">
          {/* TTS Audio Toggle */}
          {isTtsSupported && (
            <button
              className={`btn-identity-action ${isTtsEnabled ? 'tts-on' : ''}`}
              onClick={toggleTts}
              id="tts-toggle-btn"
              title={isTtsEnabled ? 'Voice output: ON' : 'Voice output: MUTED'}
              aria-label={isTtsEnabled ? 'Mute voice output' : 'Enable voice output'}
            >
              {isTtsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>{isTtsEnabled ? (isSpeaking ? 'Speaking…' : 'Voice on') : 'Muted'}</span>
            </button>
          )}

          <button
            className="btn-identity-action"
            onClick={clearChat}
            id="clear-chat-btn"
            title="Reset conversation"
            aria-label="Clear chat"
          >
            <RotateCcw size={13} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Speech Error */}
      {speechError && (
        <div className="speech-error-bar" role="alert">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={14} />
            {speechError}
          </span>
          <button className="btn-error-dismiss" onClick={clearError} aria-label="Dismiss error">&times;</button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-scroll" role="log" aria-label="Conversation" aria-live="polite">
        {messages.map(msg => (
          <div key={msg.id} className={`msg-row ${msg.sender}`}>
            <div className="msg-avatar" aria-hidden="true">
              {msg.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>

            <div className="msg-body">
              {/* Text */}
              <div className="msg-bubble">
                {msg.text.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} dangerouslySetInnerHTML={{
                    __html: paragraph
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                  }} />
                ))}
              </div>

              {/* Intent Tags */}
              {msg.intent && (msg.intent.asset || msg.intent.direction || msg.intent.timeframeLabel) && (
                <div className="intent-tags" aria-label="Parsed intent">
                  {msg.intent.asset && (
                    <span className="intent-tag asset">Asset: <strong>{msg.intent.asset}</strong></span>
                  )}
                  {msg.intent.direction && (
                    <span className={`intent-tag ${msg.intent.direction.toLowerCase()}`}>
                      Direction: <strong>{msg.intent.direction}</strong>
                    </span>
                  )}
                  {msg.intent.timeframeLabel && (
                    <span className="intent-tag">
                      <Clock size={10} aria-hidden="true" />
                      {msg.intent.timeframeLabel}
                    </span>
                  )}
                  {msg.intent.tradeAmount && (
                    <span className="intent-tag font-mono">
                      Amount: <strong>${msg.intent.tradeAmount} USDC</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Trade Review & Matched Event Contract */}
              {msg.matchedMarket && msg.intent?.direction && (
                <TradeReviewCard
                  market={msg.matchedMarket}
                  direction={msg.intent.direction}
                  initialAmount={msg.initialTradeAmount}
                  initialOpenReview={msg.initialReviewOpen}
                  onResetChat={clearChat}
                />
              )}

              {/* Status hints */}
              {msg.status === 'clarification' && (
                <div className="msg-hint clarify" role="status">
                  <HelpCircle size={13} aria-hidden="true" />
                  {activeMarketContext 
                    ? 'Reply with your desired trade amount — e.g. "$10" or "25 dollars".'
                    : 'Reply with your timeframe — e.g. "Two hours."'}
                </div>
              )}

              {msg.status === 'no_market_found' && (
                <div className="msg-hint empty" role="status">
                  <AlertCircle size={13} aria-hidden="true" />
                  No live market for this timeframe right now. Try a different window.
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Listening indicator */}
        {isListening && (
          <div className="listening-row" role="status" aria-live="polite">
            <div className="listening-bubble">
              <div className="listening-label">
                <Radio size={11} aria-hidden="true" />
                LISTENING
              </div>
              <div className="listening-transcript">
                {liveTranscript ? `"${liveTranscript}"` : 'Speak your prediction…'}
              </div>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="typing-row">
            <div className="msg-avatar" aria-hidden="true">
              <Bot size={14} />
            </div>
            <div className="typing-bubble" role="status" aria-label="Processing">
              <div className="typing-dots" aria-hidden="true">
                <span /><span /><span />
              </div>
              Finding your market…
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips */}
      <div className="suggestions-bar" aria-label="Suggested predictions">
        <span className="suggestion-label">
          <Sparkles size={11} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.2rem' }} />
          Try:
        </span>
        {SAMPLE_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            className="suggestion-chip"
            onClick={() => handleSubmit(prompt, false)}
            disabled={isProcessing || isListening}
            id={`suggestion-chip-${idx}`}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="chat-input-area">
        <button
          type="button"
          className={`mic-btn ${
            isListening ? 'active' : ''
          } ${!isSpeechSupported ? 'no-support' : ''}`}
          onClick={handleMicClick}
          disabled={isProcessing}
          id="mic-btn"
          title={
            !isSpeechSupported
              ? 'Speech recognition unavailable in this browser'
              : isListening
              ? 'Listening — click to stop'
              : 'Click to speak'
            }
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          {isListening && <span className="mic-ring" aria-hidden="true" />}
        </button>

        <input
          type="text"
          className="chat-input"
          id="chat-text-input"
          placeholder={
            isListening
              ? 'Listening…'
              : activeMarketContext
              ? 'Say or type an amount — e.g. "Take the trade with $10"'
              : 'Type your prediction — e.g. "I think BTC will go up in 2 hours"'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing || isListening}
          aria-label="Prediction input"
        />

        <button
          className="send-btn"
          onClick={() => handleSubmit(undefined, false)}
          disabled={!input.trim() || isProcessing || isListening}
          id="send-btn"
          title="Send prediction"
          aria-label="Send prediction"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};
