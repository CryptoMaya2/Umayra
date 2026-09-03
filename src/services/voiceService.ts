/**
 * Browser-Native Voice Interaction Service (Web Speech API)
 * Provides deterministic SpeechRecognition (STT) and consistent SpeechSynthesis (TTS).
 */

export interface SpeechRecognitionHandlers {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (errorMessage: string, rawError?: any) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export class VoiceService {
  private static recognitionInstance: any = null;
  private static cachedVoice: SpeechSynthesisVoice | null = null;
  private static hasInitializedVoiceListener = false;

  /**
   * Check if speech recognition is available in current browser
   */
  public static isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Check if text-to-speech is available in current browser
   */
  public static isTextToSpeechSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /**
   * Deterministically selects and locks a single assistant voice for the entire session.
   */
  public static getConsistentVoice(): SpeechSynthesisVoice | null {
    if (this.cachedVoice) {
      return this.cachedVoice;
    }

    if (!this.isTextToSpeechSupported()) {
      return null;
    }

    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      // Set up onvoiceschanged listener if not already initialized
      if (!this.hasInitializedVoiceListener && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.getConsistentVoice();
        };
        this.hasInitializedVoiceListener = true;
      }
      return null;
    }

    // Deterministic prioritization:
    // 1. Preferred Natural / High-quality US English voices
    const preferredNames = [
      'Microsoft Jenny Online (Natural) - English (United States)',
      'Google US English',
      'Samantha',
      'Microsoft Aria Online (Natural) - English (United States)',
      'Microsoft Guy Online (Natural) - English (United States)',
      'Daniel',
      'Karen'
    ];

    for (const name of preferredNames) {
      const found = voices.find(v => v.name === name || v.name.includes(name));
      if (found) {
        this.cachedVoice = found;
        return this.cachedVoice;
      }
    }

    // 2. Any Natural / Google en-US voice
    const naturalUs = voices.find(v => 
      v.lang === 'en-US' && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural'))
    );
    if (naturalUs) {
      this.cachedVoice = naturalUs;
      return this.cachedVoice;
    }

    // 3. Any en-US voice
    const standardUs = voices.find(v => v.lang === 'en-US');
    if (standardUs) {
      this.cachedVoice = standardUs;
      return this.cachedVoice;
    }

    // 4. Any English voice
    const anyEnglish = voices.find(v => v.lang.toLowerCase().startsWith('en'));
    if (anyEnglish) {
      this.cachedVoice = anyEnglish;
      return this.cachedVoice;
    }

    // 5. Deterministic fallback to first available
    this.cachedVoice = voices[0] || null;
    return this.cachedVoice;
  }

  /**
   * Start listening to microphone input using Web Speech API
   */
  public static startListening(handlers: SpeechRecognitionHandlers): () => void {
    if (!this.isSpeechRecognitionSupported()) {
      handlers.onError('Speech recognition is not supported in this browser. Please use typed input.');
      return () => {};
    }

    try {
      this.stopListening();

      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        handlers.onStart?.();
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += trans;
          } else {
            interimTranscript += trans;
          }
        }

        const text = finalTranscript || interimTranscript;
        if (text) {
          handlers.onResult(text.trim(), !!finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        let msg = 'An error occurred during voice recognition.';
        switch (event.error) {
          case 'not-allowed':
          case 'permission-denied':
            msg = 'Microphone permission was denied. Please allow microphone access to speak your prediction.';
            break;
          case 'no-speech':
            msg = 'No speech was detected. Please try speaking again.';
            break;
          case 'audio-capture':
            msg = 'No microphone was found or microphone is busy.';
            break;
          case 'network':
            msg = 'Speech recognition network error occurred.';
            break;
          default:
            msg = `Voice recognition error: ${event.error}`;
        }
        handlers.onError(msg, event);
      };

      recognition.onend = () => {
        this.recognitionInstance = null;
        handlers.onEnd?.();
      };

      this.recognitionInstance = recognition;
      recognition.start();

      return () => {
        this.stopListening();
      };
    } catch (err: any) {
      handlers.onError(`Failed to start speech recognition: ${err?.message || err}`);
      return () => {};
    }
  }

  /**
   * Stop listening immediately
   */
  public static stopListening(): void {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.abort();
      } catch {
        // Ignored
      }
      this.recognitionInstance = null;
    }
  }

  /**
   * Cleans markdown formatting for natural voice synthesis
   */
  public static stripMarkdownForSpeech(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold
      .replace(/\*(.*?)\*/g, '$1')     // remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // remove links
      .replace(/[#`_~]/g, '')         // remove markdown symbols
      .replace(/\s+/g, ' ')           // collapse whitespace
      .trim();
  }

  /**
   * Synthesize text into speech using browser SpeechSynthesis with the locked consistent voice
   */
  public static speak(
    text: string, 
    options?: { onEnd?: () => void; onError?: (err: any) => void }
  ): void {
    if (!this.isTextToSpeechSupported()) {
      options?.onEnd?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const cleanText = this.stripMarkdownForSpeech(text);
      if (!cleanText) {
        options?.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Assign deterministic consistent voice
      const voice = this.getConsistentVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        options?.onError?.(e);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      // Degrade gracefully without throwing or blocking UI
      options?.onError?.(err);
    }
  }

  /**
   * Stop any active speech playback
   */
  public static stopSpeaking(): void {
    if (this.isTextToSpeechSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignored
      }
    }
  }
}
