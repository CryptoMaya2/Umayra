import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceService } from '../services/voiceService';

export function useVoiceInteraction(options?: { autoTtsDefault?: boolean }) {
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isTtsEnabled, setIsTtsEnabled] = useState(options?.autoTtsDefault ?? true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isTtsSupported, setIsTtsSupported] = useState(false);

  const stopFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setIsSpeechSupported(VoiceService.isSpeechRecognitionSupported());
    setIsTtsSupported(VoiceService.isTextToSpeechSupported());

    return () => {
      stopFnRef.current?.();
      VoiceService.stopSpeaking();
    };
  }, []);

  const stopListening = useCallback(() => {
    stopFnRef.current?.();
    VoiceService.stopListening();
    setIsListening(false);
  }, []);

  const startListening = useCallback((onFinalResult: (text: string) => void) => {
    setSpeechError(null);
    setLiveTranscript('');
    VoiceService.stopSpeaking();

    const stop = VoiceService.startListening({
      onStart: () => {
        setIsListening(true);
      },
      onResult: (text, isFinal) => {
        setLiveTranscript(text);
        if (isFinal && text) {
          setIsListening(false);
          onFinalResult(text);
        }
      },
      onError: (errMsg) => {
        setIsListening(false);
        setSpeechError(errMsg);
      },
      onEnd: () => {
        setIsListening(false);
      }
    });

    stopFnRef.current = stop;
  }, []);

  const toggleListening = useCallback((onFinalResult: (text: string) => void) => {
    if (isListening) {
      stopListening();
    } else {
      startListening(onFinalResult);
    }
  }, [isListening, startListening, stopListening]);

  const speak = useCallback((text: string) => {
    if (!isTtsEnabled || !isTtsSupported) return;

    setIsSpeaking(true);
    VoiceService.speak(text, {
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  }, [isTtsEnabled, isTtsSupported]);

  const stopSpeaking = useCallback(() => {
    VoiceService.stopSpeaking();
    setIsSpeaking(false);
  }, []);

  const toggleTts = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setIsTtsEnabled(prev => !prev);
  }, [isSpeaking, stopSpeaking]);

  const clearError = useCallback(() => {
    setSpeechError(null);
  }, []);

  return {
    isListening,
    liveTranscript,
    speechError,
    isSpeechSupported,
    isTtsSupported,
    isTtsEnabled,
    isSpeaking,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleTts,
    clearError,
  };
}
