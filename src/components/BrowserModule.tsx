import {
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Globe,
  ExternalLink,
  ShieldCheck,
  PlayCircle,
  Search,
  Play,
  SearchCode,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useMemo, FormEvent } from "react";

// --- Native Mini-Apps within the Browser ---

// --- Main Browser Module ---

interface BrowserModuleProps {
  url: string;
  onClose: () => void;
}

export function BrowserModule({
  url: initialUrl,
  onClose,
}: BrowserModuleProps) {
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [inputText, setInputText] = useState(initialUrl);
  const [loading, setLoading] = useState(true);

  // Sync when parent passes new url prop
  useEffect(() => {
    if (initialUrl !== currentUrl) {
      navigateUrl(initialUrl);
    }
  }, [initialUrl]);

  // Handle cross-origin proxy navigation
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "AURA_NAVIGATE" && e.data.url) {
        navigateUrl(e.data.url);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [historyIndex, history]); // Dependencies for correctly pushing history

  const navigateUrl = (url: string) => {
    setCurrentUrl(url);
    setInputText(url);
    setLoading(true);
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(url);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setCurrentUrl(history[nextIndex]);
      setInputText(history[nextIndex]);
      setLoading(true);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setCurrentUrl(history[nextIndex]);
      setInputText(history[nextIndex]);
      setLoading(true);
    }
  };

  // Sync inputText for display without triggering nav
  useEffect(() => {
    setInputText(currentUrl);
  }, [currentUrl]);

  const handleLaunch = () => {
    window.open(currentUrl, "_blank");
  };

  const handleNavigate = (e: FormEvent) => {
    e.preventDefault();
    let target = inputText.trim();
    if (!target) return;

    if (!target.includes("://")) {
      if (target.includes(".") && !target.includes(" ")) {
        target = "https://" + target;
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}&igu=1`;
      }
    } else if (target.startsWith("aura://")) {
      const urlObj = new URL(target);
      const q =
        urlObj.searchParams.get("q") ||
        urlObj.searchParams.get("query") ||
        urlObj.pathname.slice(1);
      if (urlObj.hostname === "search" || urlObj.hostname === "images") {
        target = `https://www.google.com/search?q=${encodeURIComponent(q)}&igu=1`;
      } else if (urlObj.hostname === "youtube") {
        target = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      }
    }

    if (target !== currentUrl) {
      navigateUrl(target);
    }
  };

  const getDisplayUrl = () => {
    let safeUrl = currentUrl?.trim();
    if (!safeUrl) return "";

    if (safeUrl.startsWith("aura://")) {
      const urlObj = new URL(safeUrl);
      const q =
        urlObj.searchParams.get("q") ||
        urlObj.searchParams.get("query") ||
        urlObj.pathname.slice(1);
      if (urlObj.hostname === "search" || urlObj.hostname === "images") {
        safeUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&igu=1`;
      } else if (urlObj.hostname === "youtube") {
        safeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      }
    } else if (!safeUrl.includes("://") && safeUrl !== "about:blank") {
      safeUrl = "https://" + safeUrl;
    }

    if (safeUrl === "https://" || safeUrl === "about:blank") {
      return safeUrl;
    }

    if (safeUrl.includes("google.com/search") && safeUrl.includes("igu=1")) {
      return safeUrl;
    }

    if (safeUrl.includes("youtube.com/embed")) {
      return safeUrl;
    }

    return `/api/proxy?url=${encodeURIComponent(safeUrl)}`;
  };

  return (
    <div className="absolute inset-0 bg-slate-900 flex flex-col shadow-inner">
      {/* Real Browser Bar */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1 sm:gap-2 p-1.5 sm:p-2 bg-[#f1f3f4] dark:bg-[#1e1e1e] border-b border-gray-300 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            onClick={goBack}
            disabled={historyIndex <= 0}
            className={`p-1.5 sm:p-2 rounded-full transition-colors ${historyIndex > 0 ? "text-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10" : "text-slate-400 dark:text-slate-600 cursor-not-allowed"}`}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className={`p-1.5 sm:p-2 rounded-full transition-colors ${historyIndex < history.length - 1 ? "text-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10" : "text-slate-400 dark:text-slate-600 cursor-not-allowed"}`}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => {
              setLoading(true);
              const v = currentUrl;
              setCurrentUrl("");
              setTimeout(() => setCurrentUrl(v), 10);
            }}
            className="p-1.5 sm:p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Omnibox */}
        <form
          onSubmit={handleNavigate}
          className="flex-1 w-full order-last sm:order-none sm:w-auto mt-1 sm:mt-0 flex items-center bg-white dark:bg-[#2d2d2d] border border-transparent dark:border-white/5 rounded-full px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all"
        >
          {currentUrl.includes("google.com/search") ? (
            <Search size={14} className="text-blue-500 shrink-0 mr-2" />
          ) : (
            <Globe size={14} className="text-slate-400 shrink-0 mr-2" />
          )}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 min-w-[100px] w-full bg-transparent text-[13px] md:text-sm text-gray-800 dark:text-slate-200 outline-none font-medium truncate"
            placeholder="Search Google or type a URL"
          />
        </form>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            onClick={handleLaunch}
            className="p-1.5 sm:p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            title="Open in Native OS Browser"
          >
            <ExternalLink size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 ml-1 rounded-full text-slate-600 dark:text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors group"
          >
            <X size={18} className="group-hover:stroke-[2.5px]" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-white dark:bg-slate-900 overflow-hidden">
        {/* Progress Bar */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-0 left-0 w-full h-0.5 z-20"
            >
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <iframe
          src={getDisplayUrl()}
          className="w-full h-full border-none bg-white relative z-10"
          onLoad={() => setLoading(false)}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="In-App Browser Content"
        />
      </div>

      {/* Bottom Drag-to-Close Handle */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.6, bottom: 0 }}
        onDragEnd={(e, info) => {
          if (info.offset.y < -30) {
            onClose();
          }
        }}
        onClick={onClose}
        className="w-full bg-[#f1f3f4] dark:bg-[#1e1e1e] border-t border-gray-300 dark:border-white/10 flex flex-col items-center justify-center py-1.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mb-1 pointer-events-none" />
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold pointer-events-none">
          <ChevronUp size={12} className="relative top-[0.5px]" /> Swipe or
          click to close
        </div>
      </motion.div>
    </div>
  );
}
