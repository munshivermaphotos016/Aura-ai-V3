import { motion, AnimatePresence } from "motion/react";
import { ChatSession } from "../types";
import { MessageSquare, Trash2, PlusCircle, X } from "lucide-react";

interface ChatHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
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
  onNewSession,
  onClearAll,
}: ChatHistoryPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-700/50 shadow-2xl z-[150] flex flex-col"
        >
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="font-semibold text-lg text-slate-100">
              Chat History
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4">
            <button
              onClick={onNewSession}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
            >
              <PlusCircle size={18} />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center group rounded-xl transition-colors cursor-pointer ${
                  currentSessionId === session.id
                    ? "bg-slate-800 text-blue-400"
                    : "text-slate-300 hover:bg-slate-800/50 hover:text-slate-100"
                }`}
                onClick={() => onSelectSession(session.id)}
              >
                <div className="p-3 flex-1 flex items-center gap-3 overflow-hidden">
                  <MessageSquare size={16} className="shrink-0" />
                  <div className="truncate text-sm font-medium">
                    {session.title || "New Chat"}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="p-3 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete Chat"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center text-sm text-slate-500 mt-8">
                No chat history found.
              </div>
            )}
          </div>

          {sessions.length > 0 && (
            <div className="p-4 border-t border-slate-700/50">
              <button
                onClick={onClearAll}
                className="w-full py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-900/50"
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
