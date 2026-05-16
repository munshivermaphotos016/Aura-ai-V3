import { useEffect, useRef } from 'react';
import { isNativeAndroid, startNativeWakeWord, stopNativeWakeWord } from '../lib/nativeBridge';

const getSpeechRecognitionClass = () => {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
};

export function useWakeWord({
  enabled,
  wakeWord,
  language,
  onWakeWordDetected,
  isActiveListening,
  isSpeaking
}: {
  enabled: boolean;
  wakeWord: string;
  language: string;
  onWakeWordDetected: (command: string) => void;
  isActiveListening: boolean;
  isSpeaking: boolean;
}) {
  const recognitionRef = useRef<any>(null);
  const onWakeWordDetectedRef = useRef(onWakeWordDetected);

  useEffect(() => {
    onWakeWordDetectedRef.current = onWakeWordDetected;
  }, [onWakeWordDetected]);

  // Handle Native OS-Level DSP Wake Word
  useEffect(() => {
    if (enabled && isNativeAndroid()) {
      startNativeWakeWord(wakeWord, (command: string) => {
        // Run on the main loop when natively triggered
        onWakeWordDetectedRef.current(command);
      });
      return () => {
        stopNativeWakeWord();
      };
    }
  }, [enabled, wakeWord]);

  // Hack for Web ONLY: Keep a silent media stream open to prevent the browser from playing
  // the annoying "mic on/off" beep every time SpeechRecognition restarts.
  useEffect(() => {
    if (isNativeAndroid()) return; // Not needed for pure native DSP

    let stream: MediaStream | null = null;
    if (enabled) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => { stream = s; })
        .catch(console.error);
    }
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [enabled]);

  useEffect(() => {
    if (isNativeAndroid()) return; // Native DSP handles this offline silently

    // We only passively listen if enabled, and NOT actively listening or speaking
    if (!enabled || isActiveListening || isSpeaking) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      return;
    }

    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) return;

    try {
      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
           const transcript = event.results[i][0].transcript.toLowerCase().trim();
           
           // Match e.g., "aura...", "hey aura...", "okay aura..."
           const regex = new RegExp(`^(hey |okay |ok |hi |hello |listen )?${wakeWord.toLowerCase()}\\b(.*)`, 'i');
           const match = transcript.match(regex);
           
           if (match) {
             const command = match[2].trim();
             
             if (event.results[i].isFinal) {
                onWakeWordDetectedRef.current(command);
                try {
                   recognition.stop();
                } catch (e) {}
                return;
             }
           }
        }
      };

      recognition.onend = () => {
        // Automatically restart if it stops unexpectedly
        if (enabled && !isActiveListening && !isSpeaking) {
          try {
            recognitionRef.current?.start();
          } catch (e) {
             console.error("Failed to restart wake word recognition:", e);
          }
        }
      };
      
      recognition.onerror = (e: any) => {
         // Silently handle errors
      };

      recognition.start();

      return () => {
        try {
          recognition.stop();
        } catch (e) {}
      };
    } catch (err) {
      console.error("Error starting wake word listener", err);
    }
  }, [enabled, language, isActiveListening, isSpeaking, wakeWord]);

}
