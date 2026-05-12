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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AssistantSettings, Message } from "../types";
import { WaveformAnimation } from "./WaveformAnimation";
import { useLongPress } from "./useLongPress";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantUIProps {
  settings: AssistantSettings;
  onOpenSettings: () => void;
  onOpenHistory?: () => void;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  messages: Message[];
  onToggleListen: () => void;
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
        className={`max-w-[90%] p-4 rounded-3xl text-[17px] shadow-lg flex flex-col gap-3 ${
          msg.role === "user"
            ? "bg-blue-600 self-end rounded-tr-none text-white shadow-blue-900/20"
            : "bg-slate-800 self-start rounded-tl-none border border-slate-700 text-slate-50 shadow-black/40"
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
      className={`group max-w-[90%] p-4 rounded-3xl text-[17px] shadow-lg flex flex-col gap-2 relative ${
        msg.role === "user"
          ? "bg-blue-600 self-end rounded-tr-none text-white shadow-blue-900/20"
          : "bg-slate-800 self-start rounded-tl-none border border-slate-700 text-slate-50 shadow-black/40"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 overflow-hidden">
          {msg.role === "assistant" && (
            <div className="flex items-center gap-2 mb-2 text-blue-400 text-[11px] font-bold uppercase tracking-[0.2em] opacity-80 select-none">
              <Sparkles size={12} aria-hidden="true" />
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
                          onLinkClick?.(props.href);
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
  messages,
  onToggleListen,
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
      className="flex flex-col h-full w-full bg-[#0F172A] text-slate-50 font-sans relative"
      role="main"
      aria-label="Aura Assistant"
    >
      {/* Header */}
      <header className="flex justify-between items-center p-4 border-b border-slate-700/50 bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20"
            aria-hidden="true"
          >
            <div className="w-5 h-5 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight leading-tight">Aura</h1>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest opacity-80">AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenStats}
            className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all border border-slate-700/50"
            title="Usage Statistics"
            aria-label="Open Usage Statistics"
          >
            <Activity size={20} />
          </button>
          <button
            onClick={onOpenHistory}
            className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-700/50"
            title="Chat History"
            aria-label="Open Chat History"
          >
            <History size={20} />
          </button>
          <button
            onClick={onOpenAssistantSetup}
            className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-blue-400 transition-all border border-slate-700/50"
            title="Native Mode"
          >
            <Smartphone size={20} />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white transition-all border border-slate-700/50"
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
              <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/30">
                <Sparkles size={40} className="text-blue-400 animate-pulse" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">How can I help?</h2>
              <p className="text-slate-400 max-w-xs mx-auto text-lg leading-relaxed">
                I'm your assistant Aura. I can make calls, send messages, or answer your questions.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
              {SUGGESTED_ACTIONS.map((action, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => onSendText?.(action.text)}
                  className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl flex flex-col items-center text-center hover:bg-slate-800/80 transition-all group active:scale-95"
                >
                  <div className="mb-2 p-2 rounded-lg bg-slate-900 group-hover:scale-110 transition-transform">
                    {action.icon}
                  </div>
                  <span className="text-sm font-medium text-slate-200">{action.label}</span>
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
                className="bg-slate-800 self-start rounded-3xl rounded-tl-none p-5 border border-slate-700 flex items-center gap-3"
              >
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Footer / Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pt-10 bg-gradient-to-t from-[#0F172A] via-[#0F172A] to-transparent z-10">
        <div className="mb-6 flex flex-col items-center justify-center">
          <WaveformAnimation 
            active={isListening || isSpeaking} 
            color={isListening ? "#ef4444" : isSpeaking ? "#10b981" : "#3b82f6"} 
          />
          <div className="mt-2">
            {isListening ? (
              <motion.p className="text-red-400 text-sm font-semibold tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                Listening...
              </motion.p>
            ) : isSpeaking ? (
              <p className="text-emerald-400 text-sm font-semibold tracking-wide">
                Aura is speaking...
              </p>
            ) : (
              <p className="text-slate-500 text-xs font-medium tracking-wide">
                Say "{settings.wakeWord}" or tap the mic
              </p>
            )}
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
              placeholder="Ask anything..."
              autoComplete="off"
              disabled={isListening || isProcessing}
              className="w-full bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl pl-6 pr-14 py-4.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 transition-all shadow-xl placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={isListening || isProcessing}
              className="absolute right-2 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition-all disabled:opacity-0 shadow-lg shadow-blue-900/40 translate-x-0 active:scale-90"
            >
              <Send size={18} className="text-white" />
            </button>
          </form>

          <button
            onClick={isSpeaking ? onStopSpeaking : onToggleListen}
            className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl transition-all active:scale-95 outline-none shrink-0 group
               ${
                 isListening
                   ? "bg-red-500 shadow-red-500/30 rotate-12 scale-110"
                   : isSpeaking
                     ? "bg-emerald-600 shadow-emerald-500/30"
                     : "bg-blue-600 shadow-blue-500/30 hover:shadow-blue-500/50"
               }`}
          >
            {isListening ? (
              <MicOff size={32} className="text-white" />
            ) : isSpeaking ? (
              <Volume2 size={32} className="text-white" />
            ) : (
              <Mic size={32} className="text-white group-hover:scale-110 transition-transform" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
