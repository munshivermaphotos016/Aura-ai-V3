import React, { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  Plus,
  Settings2,
  Compass,
  X
} from "lucide-react";
import { AssistantSettings, Message } from "../types";

export interface OverlayAssistantUIProps {
  settings: AssistantSettings;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  interimTranscript?: string;
  messages: Message[];
  onToggleListen: () => void;
  onStopSpeaking: () => void;
  onClose: () => void;
  onExpand: () => void;
}

export function OverlayAssistantUI({
  settings,
  isListening,
  isProcessing,
  isSpeaking,
  interimTranscript,
  messages,
  onToggleListen,
  onStopSpeaking,
  onClose,
  onExpand,
}: OverlayAssistantUIProps) {
  const isActive = isListening || isProcessing || isSpeaking;
  const constraintsRef = useRef<HTMLDivElement>(null);

  const latestMessage = messages[messages.length - 1];

  let subtitleText = "";
  if (isListening) {
    subtitleText = interimTranscript || "Listening...";
  } else if (isProcessing) {
    subtitleText = "Thinking...";
  } else if (isSpeaking && latestMessage?.role === "assistant") {
    subtitleText = latestMessage.content;
  } else if (latestMessage?.role === "user") {
    subtitleText = `"${latestMessage.content}"`;
  }

  return (
    <div className="fixed inset-0 z-[300] pointer-events-none font-sans" ref={constraintsRef}>
      <AnimatePresence mode="wait">
        {!isActive ? (
          <motion.div
            key="minimized-pill"
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-4 left-0 right-0 px-4 pointer-events-auto"
          >
            <div className="mx-auto w-[92%] sm:max-w-md bg-black/50 text-white rounded-full p-2 flex items-center shadow-2xl border border-white/10 backdrop-blur-3xl">
              <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors">
                <X size={20} strokeWidth={1.5} />
              </button>
              <button className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors">
                <Settings2 size={20} strokeWidth={1.5} />
              </button>
              
              <button 
                className="flex-1 px-3 text-center text-white/70 text-[16px] font-medium tracking-wide bg-transparent min-w-0 outline-none focus:outline-none"
                onClick={() => onToggleListen()}
              >
                Ask Aura
              </button>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => onToggleListen()}
                  className="w-[44px] h-[44px] rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Mic size={20} strokeWidth={1.5} className="text-[#a8c7fa]" fill="#a8c7fa" />
                </button>
                <button 
                   onClick={onExpand}
                   className="w-[44px] h-[44px] rounded-full flex items-center justify-center text-[#a8c7fa] hover:bg-white/10 transition-colors"
                >
                  <Compass size={22} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div 
               key="subtitle-strip"
               initial={{ y: 50, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 50, opacity: 0 }}
               className="absolute bottom-6 left-4 right-4 flex justify-center pointer-events-auto"
            >
               <div className="max-w-lg w-full bg-black/40 backdrop-blur-3xl rounded-[28px] px-6 py-5 flex flex-col items-center justify-center shadow-2xl border border-white/10 min-h-[80px]">
                  <p className="text-center text-lg md:text-xl font-medium text-white/95">
                     {subtitleText || (isListening ? "Listening..." : "Hi, what can I help with?")}
                  </p>
                  
                  <button 
                    onClick={isSpeaking ? onStopSpeaking : onToggleListen}
                    className="mt-3 px-5 py-2 rounded-full border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors text-xs font-semibold uppercase tracking-wider shadow-sm"
                  >
                    {isSpeaking ? "Stop" : "Cancel"}
                  </button>
               </div>
            </motion.div>

            <motion.div
               key="floating-orb"
               drag
               dragConstraints={constraintsRef}
               dragElastic={0.1}
               dragMomentum={false}
               initial={{ scale: 0, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0, opacity: 0 }}
               className="absolute right-4 top-1/3 pointer-events-auto z-[310]"
            >
               <button
                 onClick={isSpeaking ? onStopSpeaking : onToggleListen}
                 className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)] border ${
                   isListening ? "bg-[#00f0ff]/20 border-[#00f0ff]/50" :
                   isProcessing ? "bg-[#ff00ff]/20 border-[#ff00ff]/50" :
                   isSpeaking ? "bg-[#8a2be2]/20 border-[#8a2be2]/50" :
                   "bg-white/10 border-white/20"
                 }`}
               >
                  <div className={`w-[56px] h-[56px] rounded-full flex items-center justify-center transition-all ${
                     isListening ? "bg-gradient-to-br from-[#00f0ff] to-[#0088ff] shadow-[0_0_20px_#00f0ff]" :
                     isProcessing ? "bg-gradient-to-br from-[#ff00ff] to-[#8a2be2] shadow-[0_0_20px_#ff00ff]" :
                     isSpeaking ? "bg-gradient-to-br from-[#8a2be2] to-[#4000ff] shadow-[0_0_20px_#8a2be2]" :
                     "bg-white/20"
                  }`}>
                     <div className="flex gap-[3px] items-center justify-center h-5">
                        {[...Array(4)].map((_, i) => (
                           <motion.div
                             key={i}
                             animate={{ height: !isActive ? 4 : [4, 16 + Math.random() * 8, 4] }}
                             transition={{ repeat: Infinity, duration: 0.6 + Math.random() * 0.4, delay: i * 0.15 }}
                             className={`w-[3px] rounded-full bg-white`}
                           />
                        ))}
                     </div>
                  </div>
               </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

