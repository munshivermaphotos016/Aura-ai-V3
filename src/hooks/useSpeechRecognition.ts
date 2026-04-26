import { useState, useEffect, useRef, useCallback } from 'react';

// Handle browser inconsistencies
const getSpeechRecognitionClass = () => {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
};

interface UseSpeechRecognitionProps {
  language: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onAudioEnd?: () => void;
  onAudioStart?: () => void;
  continuous?: boolean;
}

export function useSpeechRecognition({
  language,
  onResult,
  onAudioEnd,
  onAudioStart,
  continuous = false
}: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const isIntentionalStopRef = useRef(false);
  const errorRef = useRef<string | null>(null);

  // Use refs for callbacks so they don't trigger effect re-runs
  const onResultRef = useRef(onResult);
  const onAudioEndRef = useRef(onAudioEnd);
  const onAudioStartRef = useRef(onAudioStart);

  useEffect(() => {
    onResultRef.current = onResult;
    onAudioEndRef.current = onAudioEnd;
    onAudioStartRef.current = onAudioStart;
  }, [onResult, onAudioEnd, onAudioStart]);

  useEffect(() => {
    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) {
      setSupported(false);
      return;
    }

    try {
      recognitionRef.current = new SpeechRecognitionClass();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = language;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setError(null);
        errorRef.current = null;
        if (onAudioStartRef.current) onAudioStartRef.current();
      };

      let accumulator = '';
      let timer: NodeJS.Timeout | null = null;

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalSegments = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSegments += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalSegments) {
          accumulator += (accumulator ? ' ' : '') + finalSegments.trim();
        }

        const display = (accumulator + ' ' + interimTranscript).trim();
        if (display) {
          // Send as interim so UI updates immediately
          onResultRef.current(display, false);
        }

        if (timer) clearTimeout(timer);
        
        // Wait 1.5 seconds of silence before assuming they are done speaking
        timer = setTimeout(() => {
          if (accumulator) {
            onResultRef.current(accumulator, true);
            accumulator = ''; // reset for next sentence
            if (!continuous) {
               recognitionRef.current.stop(); // Force stop mic when firing a final manual sentence!
            }
          } else if (interimTranscript) {
            onResultRef.current(interimTranscript.trim(), true);
            if (!continuous) {
               recognitionRef.current.stop();
            }
          }
        }, 1500);
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.error("Speech recognition error", event.error);
          setError(event.error);
          errorRef.current = event.error;
        } else {
          // If no-speech, it shouldn't be treated as a fatal error visually, but we DO want to track it to prevent horrific restart loops
          errorRef.current = 'no-speech';
        }
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (onAudioEndRef.current) onAudioEndRef.current();
        
        // Auto-restart if continuous mode is expected to remain running, but stopped unintentionally
        // Make sure we only restart if we didn't just hit a hard error hook.
        if (continuous && !isIntentionalStopRef.current && !errorRef.current) {
          try {
             recognitionRef.current?.start();
          } catch (e) {
             console.error("Failed to restart recognition:", e);
          }
        }
      };

    } catch (err) {
      console.error("Error initializing SpeechRecognition:", err);
      setSupported(false);
    }

    return () => {
      isIntentionalStopRef.current = true;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, continuous]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    errorRef.current = null;
    isIntentionalStopRef.current = false;
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Ignored if already started
      console.warn("Recognition already started");
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    isIntentionalStopRef.current = true;
    recognitionRef.current.stop();
  }, []);

  // Update language if it changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
    }
  }, [language]);

  return {
    isListening,
    error,
    supported,
    startListening,
    stopListening
  };
}
