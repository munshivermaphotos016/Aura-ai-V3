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

function NativeYouTube({
  query,
  autoPlayFirst,
}: {
  query: string;
  autoPlayFirst?: boolean;
}) {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/yt-search?q=${encodeURIComponent(query)}`,
        );
        if (!res.ok) throw new Error("API down");
        const data = await res.json();
        const items = data.items || data;
        const vids = Array.isArray(items) ? items.slice(0, 15) : [];
        setVideos(vids);
        if (autoPlayFirst && vids.length > 0) {
          const firstId = vids[0].videoId || vids[0].url?.split("?v=")[1];
          if (firstId) setPlayingId(firstId);
        }
      } catch (err) {
        setError("Failed to fetch videos from server. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [query]);

  if (playingId) {
    return (
      <div className="w-full h-full bg-black flex flex-col">
        <div className="p-2 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <button
            onClick={() => setPlayingId(null)}
            className="text-blue-400 hover:text-blue-300 font-medium px-2 py-1 text-sm flex items-center gap-1"
          >
            <ChevronLeft size={16} /> Back to Search
          </button>
          <span className="text-slate-400 text-xs">Aura Native Player</span>
        </div>
        <div className="flex-1 w-full bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${playingId}?autoplay=1`}
            className="w-full h-full border-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950 overflow-y-auto p-4 custom-scrollbar">
      <div className="flex items-center gap-3 mb-6">
        <PlayCircle className="text-red-500" size={28} />
        <h2 className="text-xl text-white font-bold tracking-tight">
          Videos for "{query}"
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center p-10">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-red-400 p-4 bg-red-500/10 rounded-xl text-sm border border-red-500/20">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
          {videos.map((video, idx) => {
            const vidId = video.videoId || video.url?.split("?v=")[1];
            if (!vidId) return null;
            return (
              <button
                key={idx}
                onClick={() => setPlayingId(vidId)}
                className="text-left group flex flex-col gap-2 p-3 bg-slate-900 rounded-2xl border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer overflow-hidden transform hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)]"
              >
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-800 border border-slate-800">
                  <img
                    src={
                      video.thumbnail ||
                      `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`
                    }
                    alt={video.title}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <Play className="text-white fill-white w-12 h-12 drop-shadow-xl" />
                  </div>
                  {(video.durationStr ||
                    video.duration ||
                    video.lengthSeconds) && (
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                      {video.durationStr ||
                        (video.duration
                          ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, "0")}`
                          : "") ||
                        ""}
                    </span>
                  )}
                </div>
                <div className="px-1 line-clamp-2 text-sm text-slate-200 font-medium leading-snug">
                  {video.title}
                </div>
                <div className="px-1 text-xs text-slate-500 flex items-center gap-2">
                  <span>{video.author || video.uploaderName}</span>
                  <span>•</span>
                  <span>
                    {video.viewCount ||
                      (video.views
                        ? `${(video.views / 1000).toFixed(1)}K views`
                        : "")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NativeSearch({
  query,
  onNavigate,
}: {
  query: string;
  onNavigate: (url: string) => void;
}) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSearch = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`,
        );
        const data = await res.json();
        setResults(data.query.search);
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    fetchSearch();
  }, [query]);

  return (
    <div className="w-full h-full bg-white overflow-y-auto p-4 md:p-8 custom-scrollbar">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <SearchCode className="text-blue-600" size={28} />
        <h2 className="text-2xl text-gray-800 font-medium">Aura Search</h2>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-full mb-1"></div>
              <div className="h-3 bg-gray-100 rounded w-5/6"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {results.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-[13px] text-gray-500 font-medium">
                wikipedia.org › wiki › {item.title.replace(/\s+/g, "_")}
              </span>
              <button
                onClick={() =>
                  onNavigate(
                    `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
                  )
                }
                className="text-xl text-blue-700 hover:underline cursor-pointer tracking-tight text-left"
              >
                {item.title}
              </button>
              <p
                className="text-[14px] text-gray-600 leading-snug"
                dangerouslySetInnerHTML={{ __html: item.snippet + "..." }}
              />
            </div>
          ))}
          {results.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              No reliable results found on Wikipedia index for "{query}".
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

  // Decode custom intents
  const intent = useMemo(() => {
    if (currentUrl.startsWith("aura://")) {
      try {
        const urlObj = new URL(currentUrl);
        let q =
          urlObj.searchParams.get("q") ||
          urlObj.searchParams.get("query") ||
          "";
        if (!q && urlObj.pathname.length > 1 && !urlObj.pathname.includes("play")) {
           q = decodeURIComponent(urlObj.pathname.slice(1).replace(/\+/g, " "));
        }

        if (urlObj.hostname === "youtube") {
          if (urlObj.pathname.includes("play")) {
            return { type: "youtube_play", query: q };
          }
          return { type: "youtube", query: q };
        }
        if (urlObj.hostname === "search") return { type: "search", query: q };
        if (urlObj.hostname === "images")
          return { type: "search", query: q + " images" };
      } catch (e) {
        console.error("Failed to parse aura intent:", e);
      }
    }
    return null;
  }, [currentUrl]);

  useEffect(() => {
    if (intent) {
      setLoading(false);
      return;
    }
  }, [loading, currentUrl, intent]);

  const handleLaunch = () => {
    window.open(currentUrl, "_blank");
  };

  const handleNavigate = (e: FormEvent) => {
    e.preventDefault();
    let target = inputText.trim();
    if (!target) return;

    // Add http protocol if not present and not a search or aura protocol
    if (!target.includes("://") && !target.startsWith("aura://")) {
      if (target.includes(".") && !target.includes(" ")) {
        target = "https://" + target;
      } else {
        // If it's a search, use actual Google via our igu=1 hack!
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}&igu=1`;
      }
    }

    if (target !== currentUrl) {
      navigateUrl(target);
    }
  };

  // Convert currentUrl to proxied URL if it's a normal web page
  const getDisplayUrl = () => {
    if (intent) return currentUrl;

    let safeUrl = currentUrl;
    if (!safeUrl.includes("://") && !safeUrl.startsWith("aura://")) {
      safeUrl = "https://" + safeUrl;
    }

    if (safeUrl.includes("google.com/search") && safeUrl.includes("igu=1"))
      return safeUrl;
    if (safeUrl.includes("youtube.com/embed")) return safeUrl;

    // Pass everything else through our powerful new backend proxy to bypass restrictions!
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
            <RefreshCw
              size={16}
              className={loading && !intent ? "animate-spin" : ""}
            />
          </button>
        </div>

        {/* Omnibox */}
        <form
          onSubmit={handleNavigate}
          className="flex-1 w-full order-last sm:order-none sm:w-auto mt-1 sm:mt-0 flex items-center bg-white dark:bg-[#2d2d2d] border border-transparent dark:border-white/5 rounded-full px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all"
        >
          {intent ? (
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
        {/* Render Native Aura Viewer if intent matches */}
        {intent?.type === "youtube" && <NativeYouTube query={intent.query} />}
        {intent?.type === "youtube_play" && (
          <NativeYouTube query={intent.query} autoPlayFirst={true} />
        )}
        {intent?.type === "search" && (
          <NativeSearch query={intent.query} onNavigate={navigateUrl} />
        )}

        {/* Otherwise render pure iframe */}
        {!intent && (
          <iframe
            src={getDisplayUrl()}
            className={`w-full h-full border-none transition-opacity duration-1000 ${loading ? "opacity-0" : "opacity-100"} bg-white`}
            onLoad={() => setLoading(false)}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title="In-App Browser Content"
          />
        )}

        <AnimatePresence>
          {loading && !intent && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-900 p-6 text-center z-10"
            >
              <div className="relative mb-4">
                <div className="w-12 h-12 border-4 border-gray-200 dark:border-slate-700 rounded-full" />
                <div className="w-12 h-12 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
              </div>
              <p className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                Loading secure page...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
          <ChevronUp size={12} className="relative top-[0.5px]" /> Swipe or click to close
        </div>
      </motion.div>
    </div>
  );
}
