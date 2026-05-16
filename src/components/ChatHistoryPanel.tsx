import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChatSession } from "../types";
import { MessageSquare, Trash2, PlusCircle, X, Edit2 } from "lucide-react";

interface ChatHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onEditSession: (id: string, newTitle: string) => void;
  onNewSession: () => void;
  onClearAll: () => void;
}

export function ChatHistoryPanel({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onEditSession,
  onNewSession,
  onClearAll,
}: ChatHistoryPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  const handleEditSubmit = (session: ChatSession) => {
    if (editTitle.trim() && editTitle.trim() !== session.title) {
      onEditSession(session.id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 left-0 w-[320px] bg-black/40 backdrop-blur-[40px] shadow-[0_0_40px_rgba(0,0,0,0.5)] z-[150] flex flex-col border-r border-white/5"
        >
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-medium text-lg text-white/95 tracking-wide">
              Chat History
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-white/50 hover:text-white/90 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 border-b border-white/5">
            <button
              onClick={onNewSession}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 border border-white/5 text-white rounded-[1.25rem] font-medium transition-all active:scale-95 shadow-sm"
            >
              <PlusCircle size={18} />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center group rounded-[1.25rem] transition-all cursor-pointer border ${
                  currentSessionId === session.id
                    ? "bg-white/10 text-white border-white/10 shadow-sm"
                    : "bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 border-transparent"
                }`}
                onClick={() => onSelectSession(session.id)}
              >
                <div className="px-4 py-3.5 flex-1 flex items-center gap-3 overflow-hidden">
                  <MessageSquare size={16} className="shrink-0 opacity-70" />
                  {editingId === session.id ? (
                    <input
                      ref={inputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleEditSubmit(session)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSubmit(session);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-black/30 border border-white/20 rounded px-2 py-0.5 text-sm font-medium text-white outline-none focus:border-[#00f0ff]"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="truncate text-sm font-medium leading-tight">
                      {session.title || "New Chat"}
                    </div>
                  )}
                </div>
                {!editingId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditTitle(session.title || "New Chat");
                      setEditingId(session.id);
                    }}
                    className="p-3 text-white/30 hover:text-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Edit Chat Title"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                {!editingId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="p-3 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Chat"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center text-sm text-white/40 mt-8 font-medium">
                No chat history found.
              </div>
            )}
          </div>

          {sessions.length > 0 && (
            <div className="p-5 border-t border-white/5 bg-transparent">
              <button
                onClick={onClearAll}
                className="w-full py-3 text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/80 rounded-[1.25rem] transition-all border border-red-500/20 hover:border-red-500/50"
              >
                Clear All History
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
