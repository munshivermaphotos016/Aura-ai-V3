import { useState, useEffect, useMemo } from "react";
import { ChatSession, Message } from "../types";
import { generateId } from "../lib/ids";

export function useChatManager() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem("auraSessions");
      if (saved) {
        return JSON.parse(saved);
      }

      // Migrate old messages
      const oldMessages = localStorage.getItem("auraMessages");
      if (oldMessages) {
        try {
          const parsed = JSON.parse(oldMessages);
          if (parsed && parsed.length > 0) {
            const newSession: ChatSession = {
              id: generateId(),
              title: "Previous Chat",
              messages: parsed.map((m: any) => ({
                ...m,
                id: generateId(),
              })),
              updatedAt: Date.now(),
            };
            localStorage.removeItem("auraMessages");
            return [newSession];
          }
        } catch (e) {
          console.error("Migration error", e);
        }
      }
      return [];
    } catch (e) {
      console.warn("LocalStorage blocked or corrupted", e);
      return [];
    }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => {
      try {
        if (sessions.length > 0) {
          // Return the most recently updated session
          return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
        }
      } catch (e) {}
      return null;
    },
  );

  const [memory, setMemory] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem("auraMemory");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem("auraSessions", JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to persist sessions", e);
    }
  }, [sessions]);

  // Persist memory
  useEffect(() => {
    try {
      localStorage.setItem("auraMemory", JSON.stringify(memory));
    } catch (e) {
      console.error("Failed to persist memory", e);
    }
  }, [memory]);

  const currentSession = useMemo(() => {
    if (!currentSessionId) return null;
    return sessions.find((s) => s.id === currentSessionId) || null;
  }, [sessions, currentSessionId]);

  const messages = currentSession?.messages || [];

  const autoGenerateTitle = (msgs: Message[]) => {
    const firstUserMsg = msgs.find((m) => m.role === "user");
    if (!firstUserMsg) return "New Chat";
    const text = firstUserMsg.content;
    return text.length > 25 ? text.substring(0, 25) + "..." : text;
  };

  const setMessages = (
    newMessages: Message[] | ((prev: Message[]) => Message[]),
  ) => {
    setSessions((prev) => {
      const sessionId = currentSessionId;
      if (!sessionId) {
        // Create new session if none exists
        const actualMessages =
          typeof newMessages === "function" ? newMessages([]) : newMessages;
        const newSession: ChatSession = {
          id: generateId(),
          title: autoGenerateTitle(actualMessages),
          messages: actualMessages,
          updatedAt: Date.now(),
        };
        setTimeout(() => setCurrentSessionId(newSession.id), 0);
        return [newSession, ...prev];
      }

      return prev.map((s) => {
        if (s.id === sessionId) {
          const updatedMessages =
            typeof newMessages === "function"
              ? newMessages(s.messages)
              : newMessages;
          return {
            ...s,
            title:
              s.title === "New Chat" || s.title === "Previous Chat"
                ? autoGenerateTitle(updatedMessages)
                : s.title,
            messages: updatedMessages,
            updatedAt: Date.now(),
          };
        }
        return s;
      });
    });
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      updatedAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const editSessionTitle = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
  };

  const clearAllSessions = () => {
    setSessions([]);
    setCurrentSessionId(null);
  };

  const saveMemory = (newMemoryData: Record<string, any>) => {
    setMemory((prev) => ({ ...prev, ...newMemoryData }));
  };

  const clearMemory = () => {
    setMemory({});
  };

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    messages,
    setMessages,
    createNewSession,
    deleteSession,
    editSessionTitle,
    clearAllSessions,
    memory,
    saveMemory,
    clearMemory,
  };
}
