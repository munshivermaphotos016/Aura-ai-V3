import { useState, useEffect, useCallback, useRef } from 'react';
import { AssistantSettings } from '../types';

export function useSpeechSynthesis(settings: AssistantSettings) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  
  // Track if we should interrupt current speech
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }

    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      let availableVoices = synthRef.current!.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    return () => {
      if (synthRef.current) {
         synthRef.current.cancel();
      }
      if (audioRef.current) {
         audioRef.current.pause();
      }
    };
  }, []);

  const speak = useCallback(async (rawText: string, voiceId?: string, onEndCallback?: () => void) => {
    // Clean text of markdown and symbols for better speech
    const cleanTextForSpeech = (str: string) => {
      let cleaned = str.replace(/```[\s\S]*?```/g, ''); // Remove code blocks
      cleaned = cleaned.replace(/[*_~`]/g, ''); // Remove basic markdown
      cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, 'link'); // Remove URLs
      cleaned = cleaned.replace(/[#\-\[\]]/g, ''); // Remove list dashes, hashes, brackets
      
      // Attempt generic emoji strip
      // Using a widely accepted emoji regex range
      cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
      
      return cleaned.trim();
    };

    const text = cleanTextForSpeech(rawText);
    
    if (!text) {
      if (onEndCallback) onEndCallback();
      return;
    }

    // 1. Check if High-Quality / Cloned TTS Engine is enabled
    const { provider, baseUrl, voiceGender, cloneAudioBase64 } = settings.ttsEngine;
    
    if (provider !== 'browser') {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsSpeaking(true);
      try {
        const payload: any = {
          input: text,
          voice: voiceId || settings.ttsEngine.voiceId || (voiceGender === 'male' ? 'male_default' : 'female_default'),
          gender: voiceGender,
          speed: 1.0
        };
        
        // Custom model specs for Coqui/Moss
        if (provider === 'coqui') payload.model = "xtts_v2";
        if (provider === 'moss') payload.engine = "neural_moss_v1";

        // Pass base64 zero-shot cloning audio sample if profile exists
        if (cloneAudioBase64) {
             payload.speaker_wav = cloneAudioBase64;
             payload.cloning = true;
        }

        // Logic for endpoint resolution
        let endpoint = baseUrl || '';
        
        if (!endpoint) {
           if (provider === 'coqui') {
              console.warn("Coqui engine selected but no Base URL provided. Falling back.");
           } else if (provider === 'moss') {
              console.warn("Moss engine selected but no Base URL provided. Falling back.");
           }
           throw new Error("No operational TTS endpoint provided for the selected engine.");
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (settings.ttsEngine.apiKey) {
           headers['Authorization'] = `Bearer ${settings.ttsEngine.apiKey}`;
        }

        // For simulation / missing actual native binary in browser:
        // We attempt the fetch, but fallback to browser if endpoint is unreachable.
        let response: Response;
        if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
           response = await fetch(endpoint, {
             method: 'POST',
             headers,
             body: JSON.stringify(payload)
           });
        } else {
           response = await fetch('/api/proxy', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               url: endpoint,
               headers,
               body: payload
             })
           });
        }

        if (!response.ok) {
           const errJson = await response.json().catch(() => ({}));
           throw new Error(errJson.details || "TTS Engine unreachable or rejected request");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const audio = new Audio(url);
        audioRef.current = audio;
        
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          if (onEndCallback) onEndCallback();
        };
        
        audio.play();
      } catch (err) {
        console.warn("High-Quality TTS failed, falling back to Browser synthesis.", err);
        setIsSpeaking(false);
        // Explicitly continue to fallback logic below by NOT returning
      }
      
      // If we made it here and audio is playing, we return. 
      // If we errored, we fall through to Browser TTS.
      if (audioRef.current && !audioRef.current.paused) return;
    }

    // 2. Default Browser TTS implementation (Robot fallback)
    if (!synthRef.current) return;
    
    // Stop any ongoing speech
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply Gender-based characteristic adjustments (Authoritative/Deep)
    if (settings.ttsEngine.voiceGender === 'male') {
       utterance.pitch = 0.75; // Even deeper for that classic "Amitabh" resonance
       utterance.rate = 0.9;  // Slightly more calculated and authoritative
       utterance.volume = 1.0;
    } else if (settings.ttsEngine.voiceGender === 'female') {
       utterance.pitch = 1.05;
       utterance.rate = 1.0;
    }

    // Auto-detect Hindi characters
    const isHindiText = /[\u0900-\u097F]/.test(text);
    const targetLang = isHindiText ? 'hi-IN' : settings.language;
    utterance.lang = targetLang;
    
    if (voices.length > 0) {
      let selectedVoice = voiceId ? voices.find(v => v.voiceURI === voiceId || v.name === voiceId) : undefined;
      
      // If no valid explicit override, adjust based on gender and language
      if (!selectedVoice || (!voiceId && isHindiText)) {
        let preferred = voices.filter(v => v.lang === targetLang || v.lang.replace('_', '-') === targetLang);
        
        if (preferred.length === 0) {
           preferred = voices.filter(v => v.lang.startsWith(targetLang.split('-')[0]));
        }
        
        if (preferred.length === 0 && isHindiText) {
          preferred = voices.filter(v => v.lang.includes('IN') || v.lang.includes('hi')); 
        }

        // Filter by gender keywords if possible
        if (settings.ttsEngine.voiceGender === 'male') {
           const maleVoices = preferred.filter(v => 
              v.name.toLowerCase().includes('male') || 
              v.name.toLowerCase().includes('david') || 
              v.name.toLowerCase().includes('ravi') || 
              v.name.toLowerCase().includes('mark') ||
              v.name.toLowerCase().includes('guy') ||
              v.name.toLowerCase().includes('stefan') ||
              v.name.toLowerCase().includes('madhur') ||
              v.name.toLowerCase().includes('prabhat')
           );
           if (maleVoices.length > 0) preferred = maleVoices;
        } else if (settings.ttsEngine.voiceGender === 'female') {
           const femaleVoices = preferred.filter(v => 
              v.name.toLowerCase().includes('female') || 
              v.name.toLowerCase().includes('zira') || 
              v.name.toLowerCase().includes('google hindi') || 
              v.name.toLowerCase().includes('heera') ||
              v.name.toLowerCase().includes('susan') ||
              v.name.toLowerCase().includes('jenny') ||
              v.name.toLowerCase().includes('neerja') ||
              v.name.toLowerCase().includes('swara')
           );
           if (femaleVoices.length > 0) preferred = femaleVoices;
        }

        if (preferred.length > 0) {
           // EXTREME prioritization of Neural/Natural/Online/Premium
           // These are the "Human-like" voices. Everything else is a legacy robot.
           const humanLike = preferred.filter(v => 
              v.name.toLowerCase().includes("natural") || 
              v.name.toLowerCase().includes("neural") || 
              v.name.toLowerCase().includes("wavenet") ||
              v.name.toLowerCase().includes("online") ||
              v.name.toLowerCase().includes("premium") ||
              v.name.toLowerCase().includes("multilingual")
           );
           
           if (humanLike.length > 0) {
              // Favor specific "Premium" or "Natural" ones if many exist
              const premium = humanLike.find(v => v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("neural"));
              selectedVoice = premium || humanLike[0];
           } else {
              // Fallback to Google voices which are usually better than Windows defaults
              const google = preferred.find(v => v.name.toLowerCase().includes("google"));
              selectedVoice = google || preferred[0];
           }
        }
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEndCallback) onEndCallback();
    };
    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      setIsSpeaking(false);
      if (onEndCallback) onEndCallback();
    };

    synthRef.current.speak(utterance);
  }, [settings, voices]);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsSpeaking(false);
  }, []);

  return {
    voices,
    isSpeaking,
    supported,
    speak,
    stop
  };
}
