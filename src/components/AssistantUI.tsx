import { useState, useEffect, useRef } from "react";
import {
  Settings as SettingsIcon,
  Mic,
  MicOff,
  Volume2,
  Globe,
  Phone,
  MessageSquare,
  AlertCircle,
  Send,
  Smartphone,
  History,
  Sparkles,
  Activity,
  Copy,
  Search,
  Edit2,
  Trash2,
  Check,
  MonitorPlay,
  MonitorOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AssistantSettings, Message } from "../types";
import { WaveformAnimation } from "./WaveformAnimation";
import { useLongPress } from "./useLongPress";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isNativeAndroid, submitNativeIntent } from "../lib/nativeBridge";

interface AssistantUIProps {
  settings: AssistantSettings;
  onOpenSettings: () => void;
  onOpenHistory?: () => void;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isScreenSharing?: boolean;
  messages: Message[];
  onToggleListen: () => void;
  onToggleScreenShare?: () => void;
  onStopSpeaking: () => void;
  onSendText?: (text: string) => void;
  onOpenAssistantSetup?: () => void;
  onOpenStats?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
  onSearchWeb?: (query: string) => void;
  onLinkClick?: (url: string) => void;
}

const SUGGESTED_ACTIONS = [
  { icon: <MessageSquare className="text-emerald-400" size={18} />, label: "Send a message", text: "Send a message to " },
  { icon: <Phone className="text-blue-400" size={18} />, label: "Make a call", text: "Call " },
  { icon: <Globe className="text-purple-400" size={18} />, label: "Search news", text: "What's the latest news?" },
  { icon: <Sparkles className="text-amber-400" size={18} />, label: "Tell a joke", text: "Tell me a joke" },
];

function MessageBubble({
  msg,
  onEdit,
  onDelete,
  onSearchWeb,
  onLinkClick,
}: {
  msg: Message;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onSearchWeb?: (query: string) => void;
  onLinkClick?: (url: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);

  const longPressProps = useLongPress(() => {
    setShowOptions(true);
  }, 500);

  const handleContextMenu = (e: React.MouseEvent) => {
    const selectedText = window.getSelection()?.toString();
    if (!selectedText) {
      e.preventDefault();
      setShowOptions(!showOptions);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShowOptions(false);
    }, 2000);
  };

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`max-w-[90%] p-5 rounded-3xl text-[17px] flex flex-col gap-3 ${
          msg.role === "user"
            ? "bg-gradient-to-br from-[#00f0ff]/20 to-[#8a2be2]/20 self-end rounded-tr-none text-white shadow-[0_0_20px_rgba(0,240,255,0.15)] border border-white/10 aura-glass"
            : "bg-white/5 self-start rounded-tl-none border border-white/10 text-white shadow-[0_0_30px_rgba(138,43,226,0.1)] aura-glass"
        }`}
      >
        <textarea
          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-sm text-white resize-none outline-none focus:ring-2 focus:ring-blue-500"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={3}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setIsEditing(false);
              setEditContent(msg.content);
            }}
            className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onEdit?.(msg.id, editContent);
              setIsEditing(false);
            }}
            className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...longPressProps}
      onContextMenu={handleContextMenu}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      style={{ zIndex: showOptions ? 9999 : 1 }}
      className={`group max-w-[90%] p-5 rounded-3xl text-[16px] leading-[1.6] flex flex-col gap-2 relative transition-all shadow-sm ${
        msg.role === "user"
          ? "bg-[#2d2f33]/80 backdrop-blur-2xl self-end rounded-tr-sm text-white/95 border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
          : "bg-[#1f2023]/80 backdrop-blur-2xl self-start rounded-tl-sm border border-white/5 text-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 overflow-hidden">
          {msg.role === "assistant" && (
            <div className="flex items-center gap-1.5 mb-2.5 text-[#a8c7fa] text-[12px] font-medium tracking-wide opacity-90 select-none">
              <Sparkles size={14} aria-hidden="true" fill="#a8c7fa" className="text-[#a8c7fa]" />
              <span>Aura</span>
            </div>
          )}
          <div className="whitespace-pre-wrap leading-relaxed select-text cursor-text relative z-10 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => {
                  return (
                    <a
                      {...props}
                      href={props.href}
                      onClick={(e) => {
                        e.preventDefault();
                        if (props.href) {
                          if (props.href.startsWith("aura://")) {
                            try {
                              const urlObj = new URL(props.href);
                              const host = urlObj.hostname;
                              const q = urlObj.searchParams.get("q") || urlObj.searchParams.get("query") || urlObj.pathname.replace(/^\/+/, '');
                              
                              if (isNativeAndroid()) {
                                if (host === "youtube") {
                                  submitNativeIntent(`intent://search/${q}#Intent;package=com.google.android.youtube;scheme=vnd.youtube;end;`);
                                } else if (host === "maps") {
                                  submitNativeIntent(`geo:0,0?q=${encodeURIComponent(q)}`);
                                } else if (host === "playstore" || host === "store") {
                                  submitNativeIntent(`market://search?q=${encodeURIComponent(q)}`);
                                } else if (host === "settings") {
                                  submitNativeIntent(`intent://#Intent;action=android.settings.SETTINGS;end;`);
                                } else {
                                  submitNativeIntent(props.href);
                                }
                              } else {
                                // Web fallback
                                if (host === "youtube") {
                                  window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, "_blank");
                                } else if (host === "maps") {
                                  window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}`, "_blank");
                                } else if (host === "playstore" || host === "store") {
                                  window.open(`https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps`, "_blank");
                                } else if (host === "search" && onSearchWeb) {
                                  onSearchWeb(q);
                                } else {
                                  onLinkClick?.(props.href);
                                }
                              }
                            } catch (err) {
                              console.error("Invalid aura:// intent format", err);
                              onLinkClick?.(props.href);
                            }
                          } else {
                            onLinkClick?.(props.href);
                          }
                        }
                      }}
                      className="text-blue-400 hover:text-blue-300 underline"
                    />
                  );
                }
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`absolute top-full mt-2 w-max max-w-[200px] bg-slate-900 border border-slate-700 shadow-xl rounded-xl z-50 flex flex-col items-stretch overflow-hidden ${
              msg.role === "user" ? "right-0" : "left-0"
            }`}
          >
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-slate-800 transition-colors"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy Message"}
            </button>
            <button
              onClick={() => {
                const selectedText = window.getSelection()?.toString() || msg.content;
                onSearchWeb?.(selectedText);
                setShowOptions(false);
              }}
              className="flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-slate-800 transition-colors"
            >
              <Search size={16} />
              Search on Web
            </button>
            <button
              onClick={() => {
                setIsEditing(true);
                setShowOptions(false);
              }}
              className="flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-slate-800 transition-colors"
            >
              <Edit2 size={16} />
              Edit
            </button>
            <button
              onClick={() => {
                onDelete?.(msg.id);
                setShowOptions(false);
              }}
              className="flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-slate-800 transition-colors text-red-400"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dismiss overlay */}
      {showOptions && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={(e) => {
            e.stopPropagation();
            setShowOptions(false);
          }} 
        />
      )}
    </motion.div>
  );
}

export function AssistantUI({
  settings,
  onOpenSettings,
  onOpenHistory,
  isListening,
  isProcessing,
  isSpeaking,
  isScreenSharing,
  messages,
  onToggleListen,
  onToggleScreenShare,
  onStopSpeaking,
  onSendText,
  onOpenAssistantSetup,
  onOpenStats,
  onEditMessage,
  onDeleteMessage,
  onSearchWeb,
  onLinkClick,
}: AssistantUIProps) {
  const currentMsgRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const isEmpty = messages.length === 0;

  return (
    <div
      className="flex flex-col h-full w-full bg-transparent text-slate-50 font-sans relative"
      role="main"
      aria-label="Aura Assistant"
    >
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 bg-white/5 backdrop-blur-2xl sticky top-0 z-20 border-b border-white/5 mx-2 mt-2 rounded-[2rem] shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
            aria-hidden="true"
          >
            <Sparkles size={18} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-lg font-medium tracking-wide leading-tight text-white/95">Aura</h1>
            <p className="text-[11px] text-white/50 font-medium uppercase tracking-[0.05em]">AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenStats}
            className="p-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Usage Statistics"
            aria-label="Open Usage Statistics"
          >
            <Activity size={20} />
          </button>
          <button
            onClick={onOpenHistory}
            className="p-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Chat History"
            aria-label="Open Chat History"
          >
            <History size={20} />
          </button>
          <button
            onClick={onOpenAssistantSetup}
            className="p-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Native Mode"
          >
            <Smartphone size={20} />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Settings"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-48 overscroll-contain touch-pan-y"
        aria-live="polite"
        role="log"
      >
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-8">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="w-24 h-24 bg-gradient-to-tr from-[#3b82f6] to-[#8b5cf6] rounded-[2rem] flex items-center justify-center mx-auto shadow-[0_8px_32px_rgba(59,130,246,0.4)]">
                <Sparkles size={48} className="text-white drop-shadow-md" fill="white" />
              </div>
              <h2 className="text-4xl font-semibold text-white/95 tracking-tight mt-6">How can I help?</h2>
              <p className="text-white/50 max-w-sm mx-auto text-lg leading-relaxed font-normal">
                I'm Aura. I can draft emails, set reminders, or answer your questions.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-md pt-4">
              {SUGGESTED_ACTIONS.map((action, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => onSendText?.(action.text)}
                  className="px-5 py-4 bg-white/5 border border-white/5 backdrop-blur-xl rounded-[1.5rem] flex flex-col items-start hover:bg-white/10 transition-all group active:scale-95"
                >
                  <div className="mb-3 p-2.5 rounded-[1rem] bg-white/10 group-hover:scale-110 transition-transform">
                    {action.icon}
                  </div>
                  <span className="text-[15px] font-medium text-white/90 tracking-wide text-left">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble 
                key={msg.id} 
                msg={msg} 
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onSearchWeb={onSearchWeb}
                onLinkClick={onLinkClick}
              />
            ))}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/5 aura-glass self-start rounded-3xl rounded-tl-none p-5 border border-white/10 flex items-center gap-3 shadow-[0_0_20px_rgba(138,43,226,0.15)]"
              >
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse drop-shadow-[0_0_8px_rgba(0,240,255,1)]" />
                  <div className="w-2 h-2 rounded-full bg-[#8a2be2] animate-pulse [animation-delay:0.2s] drop-shadow-[0_0_8px_rgba(138,43,226,1)]" />
                  <div className="w-2 h-2 rounded-full bg-[#ff00ff] animate-pulse [animation-delay:0.4s] drop-shadow-[0_0_8px_rgba(255,0,255,1)]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Footer / Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pt-10 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/95 to-transparent z-10">
        <div className="mb-6 flex flex-col items-center justify-center">
          <WaveformAnimation 
            active={isListening || isSpeaking} 
          />
          <div className="mt-4 h-6">
            <AnimatePresence mode="wait">
              {isListening ? (
                <motion.p 
                  key="listening"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-[#00f0ff] text-sm font-semibold tracking-wide flex items-center gap-2 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]"
                >
                  <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
                  Listening...
                </motion.p>
              ) : isSpeaking ? (
                <motion.p 
                  key="speaking"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-[#8a2be2] text-sm font-semibold tracking-wide drop-shadow-[0_0_8px_rgba(138,43,226,0.8)]"
                >
                  Aura is speaking...
                </motion.p>
              ) : (
                <motion.p 
                  key="idle"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-white/60 text-xs font-medium tracking-wider"
                >
                  Tap the mic or say "{settings.wakeWord}"
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="w-full max-w-lg mx-auto flex items-center gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const text = (e.target as any).message.value.trim();
              if (text) {
                onSendText?.(text);
                (e.target as any).reset();
              }
            }}
            className="flex-1 flex items-center relative group"
          >
            <input
              name="message"
              type="text"
              placeholder="Message Aura..."
              autoComplete="off"
              disabled={isListening || isProcessing}
              className="w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full pl-6 pr-14 py-4 text-[15px] focus:outline-none focus:bg-white/10 focus:border-white/20 disabled:opacity-50 transition-all shadow-xl placeholder:text-white/40 text-white"
            />
            <button
              type="submit"
              disabled={isListening || isProcessing}
              className="absolute right-2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all disabled:opacity-0 shadow-sm translate-x-0 active:scale-95 border border-white/5"
            >
              <Send size={18} className="text-white/80" />
            </button>
          </form>

          <button
            onClick={onToggleScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all outline-none shrink-0 border border-white/10 backdrop-blur-xl ${
              isScreenSharing
                ? "bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-emerald-400"
                : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
            }`}
          >
            {isScreenSharing ? <MonitorPlay size={20} /> : <MonitorOff size={20} />}
          </button>

          <button
            onClick={isSpeaking ? onStopSpeaking : onToggleListen}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 outline-none shrink-0 group border border-white/10 backdrop-blur-xl
               ${
                 isListening
                   ? "bg-white/20 shadow-[0_0_20px_rgba(0,240,255,0.4)] scale-110"
                   : isSpeaking
                     ? "bg-white/20 shadow-[0_0_20px_rgba(138,43,226,0.4)]"
                     : "bg-white/10 hover:bg-white/20"
               }`}
          >
            {isListening ? (
              <MicOff size={24} className="text-[#00f0ff]" />
            ) : isSpeaking ? (
               <Volume2 size={24} className="text-[#8a2be2]" />
            ) : (
              <Mic size={24} className="text-white/90 group-hover:text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
