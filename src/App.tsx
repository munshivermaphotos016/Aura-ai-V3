import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AssistantSettings, defaultSettings, Message } from "./types";
import { AssistantUI } from "./components/AssistantUI";
import { UsageStats } from "./components/UsageStats";
import { Settings } from "./components/Settings";
import { BrowserModule } from "./components/BrowserModule";
import { TaskTracker, TaskTrackerProps } from "./components/TaskTracker";
import { ChatHistoryPanel } from "./components/ChatHistoryPanel";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { parseLocalCommand } from "./lib/localCommands";
import { processWithCloudEngine } from "./lib/cloudEngine";

import { useChatManager } from "./hooks/useChatManager";
import { generateId } from "./lib/ids";
import { useAssistantTriggers } from "./hooks/useAssistantTriggers";
import { isNativeAndroid } from "./lib/nativeBridge";

export default function App() {
  const {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    messages,
    setMessages,
    createNewSession,
    deleteSession,
    clearAllSessions,
    memory,
    saveMemory,
    clearMemory,
  } = useChatManager();

  const [settings, setSettings] = useState<AssistantSettings>(() => {
    try {
      const saved = localStorage.getItem("visionVoiceSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deep merge or at least ensure new root level arrays/objects exist
        // Migrating contacts
        let contacts = parsed.contacts;
        if (!contacts && parsed.contactList) {
          contacts = Object.entries(
            parsed.contactList as Record<string, string>,
          ).map(([name, number], idx) => ({
            id: `legacy-${idx}`,
            name: name.charAt(0).toUpperCase() + name.slice(1),
            number,
          }));
        }

        return {
          ...defaultSettings,
          ...parsed,
          cloudEngine: {
            ...defaultSettings.cloudEngine,
            ...parsed.cloudEngine,
          },
          ttsEngine: { ...defaultSettings.ttsEngine, ...parsed.ttsEngine },
          customProviders:
            parsed.customProviders || defaultSettings.customProviders,
          selectedProviderId:
            parsed.selectedProviderId || defaultSettings.selectedProviderId,
          contacts: contacts || defaultSettings.contacts,
        };
      }
      return defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [pendingContactSearch, setPendingContactSearch] = useState<{
    type: string;
    name: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: "call" | "message";
    number?: string;
    name?: string;
    step: "confirm" | "draft" | "confirm_send" | "wait_number";
    content?: string;
  } | null>(null);
  const [wasLastInputVoice, setWasLastInputVoice] = useState(false);
  const wasLastInputVoiceRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState<{
    steps: any[];
    currentIndex: number;
  } | null>(null);
  const [activeTaskTracker, setActiveTaskTracker] =
    useState<TaskTrackerProps | null>(null);
  const [queuedSystemAction, setQueuedSystemAction] = useState<
    (() => void) | null
  >(null);
  const [isAssistantSetupOpen, setIsAssistantSetupOpen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);

  const {
    voices,
    isSpeaking,
    supported: ttsSupported,
    speak,
    stop: stopSpeaking,
  } = useSpeechSynthesis(settings);

  const handleActionExecution = useCallback(
    (
      type: "call" | "message" | "whatsapp",
      number: string,
      content?: string,
    ) => {
      // Small delay helps prevent popup blockers from freezing react state sometimes
      setTimeout(() => {
        const a = document.createElement("a");
        a.target = "_blank"; // Use _blank to bypass iframe top-navigation restrictions

        let url = "";

        if (type === "call") {
          if (settings.androidMode) {
            // In native android mode wrapper, ACTION_CALL intent can directly dial if permission is granted
            url = `intent://#Intent;action=android.intent.action.CALL;data=tel:${number};end`;
          } else {
            url = `tel:${number}`;
          }
        } else if (type === "whatsapp") {
          const body = content ? `&text=${encodeURIComponent(content)}` : "";
          if (settings.androidMode) {
            url = `intent://send?phone=${number}${body}#Intent;package=com.whatsapp;scheme=whatsapp;end;`;
          } else {
            url = `https://wa.me/${number}${content ? `?text=${encodeURIComponent(content)}` : ""}`;
          }
        } else {
          // Normal SMS message
          const body = content ? `?body=${encodeURIComponent(content)}` : "";
          if (settings.androidMode) {
            url = `intent://#Intent;action=android.intent.action.SENDTO;data=smsto:${number};S.sms_body=${encodeURIComponent(content || "")};end`;
          } else {
            url = `sms:${number}${body}`;
          }
        }

        if (typeof window !== "undefined" && (window as any).Android && typeof (window as any).Android.executeAction === "function") {
             (window as any).Android.executeAction(type, number, content || "");
             return;
        }

        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, 100);
    },
    [settings.androidMode],
  );

  /**
   * Assistant Activation Logic (Shake / Button / Trigger)
   */
  const handleAssistantTrigger = useCallback(
    (type: "shake" | "native" | "voice") => {
      // DON'T trigger if we are already doing something important or already speaking/listening
      if (isSpeaking || isProcessing) return;

      // Clear current UI blockers
      setBrowserUrl(null);
      setIsHistoryPanelOpen(false);
      setShowSettings(false);

      if (isSpeaking) {
        stopSpeaking();
      }

      // Vibrate if on mobile/native
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }

      const greeting = "Yes, I'm listening. How can I help you?";

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: greeting,
          timestamp: Date.now(),
        },
      ]);

      speak(greeting, settings.voiceId, () => {
        startListeningRef.current();
      });
    },
    [isSpeaking, stopSpeaking, speak, settings.voiceId],
  );

  // Hook into shake and bridge events
  useAssistantTriggers({
    onTrigger: handleAssistantTrigger,
    shakeEnabled: settings.hardwareTriggerEnabled,
    nativeEnabled: settings.powerButtonTriggerEnabled,
  });

  const executeNextTaskStep = useCallback(
    async (task: { steps: any[]; currentIndex: number }) => {
      if (task.currentIndex >= task.steps.length) {
        setCurrentTask(null);
        return;
      }

      const step = task.steps[task.currentIndex];

      // Process step based on action
      switch (step.action) {
        case "open_app":
          // Map common app names to our browser engine
          const safeQuery = step.payload?.query || "";
          const safeApp = step.payload?.app || "";

          const appMap: Record<string, string> = {
            jiohotstar: `aura://youtube/search?q=${encodeURIComponent(safeQuery + " hotstar")}`,
            hotstar: `aura://youtube/search?q=${encodeURIComponent(safeQuery + " hotstar")}`,
            youtube: `aura://youtube/search?q=${encodeURIComponent(safeQuery)}`,
            netflix: `aura://youtube/search?q=${encodeURIComponent(safeQuery + " movie scene")}`,
            prime: `aura://youtube/search?q=${encodeURIComponent(safeQuery + " prime video scene")}`,
            whatsapp: `https://web.whatsapp.com/`,
            telegram: `https://web.telegram.org/`,
            playstore: `https://play.google.com/store/search?q=${encodeURIComponent(safeQuery)}`,
            appstore: `https://www.apple.com/us/search/${encodeURIComponent(safeQuery)}?src=globalnav`,
            instagram: `https://www.instagram.com/explore/tags/${encodeURIComponent(safeQuery.replace(/\s+/g, ""))}/`,
            facebook: `https://www.facebook.com/search/top?q=${encodeURIComponent(safeQuery)}`,
            twitter: `https://twitter.com/search?q=${encodeURIComponent(safeQuery)}`,
            chrome: `https://www.google.com/search?q=${encodeURIComponent(safeQuery)}&igu=1`,
            google: `https://www.google.com/search?q=${encodeURIComponent(safeQuery)}&igu=1`,
            images: `https://www.google.com/search?q=${encodeURIComponent(safeQuery)}&tbm=isch&igu=1`,
          };
          const appUrl =
            appMap[safeApp.toLowerCase().replace(/\s/g, "")] ||
            `https://www.google.com/search?q=${encodeURIComponent(safeQuery)}&igu=1`;
          setBrowserUrl(appUrl);
          break;

        case "open_store":
          const safeStoreQuery = step.payload?.query || "";
          const storeUrl = `https://play.google.com/store/search?q=${encodeURIComponent(safeStoreQuery)}&c=apps`;
          setBrowserUrl(storeUrl);
          break;

        case "app_message":
          // Simulate app messaging context
          const msgType = (step.payload?.app || "").toLowerCase();
          const msgPerson = step.payload?.person || "";
          const msgContent = step.payload?.content || "";

          // Find contact or use name
          const contact = (settings.contacts || []).find(
            (c) => c.name.toLowerCase() === msgPerson.toLowerCase(),
          );
          setPendingAction({
            type: "message",
            number: contact?.number || "0000000000",
            name: contact?.name || msgPerson,
            step: msgContent ? "confirm_send" : "draft",
            content: msgContent,
          });
          break;

        case "search_contact":
          const searchName = step.payload?.name || "";
          const nextAction = step.payload?.nextAction || "";
          const found = (settings.contacts || []).find((c) =>
            c.name.toLowerCase().includes(searchName.toLowerCase()),
          );

          if (found) {
            setPendingAction({
              type: nextAction === "call" ? "call" : "message",
              number: found.number,
              name: found.name,
              step: "confirm",
            });
          } else {
            setPendingContactSearch({ type: nextAction, name: searchName });
          }
          break;
      }

      setCurrentTask({ ...task, currentIndex: task.currentIndex + 1 });
    },
    [settings.contacts],
  );

  // Audio elements for feedback
  const beepStartRef = useRef<HTMLAudioElement | null>(null);
  const beepEndRef = useRef<HTMLAudioElement | null>(null);

  // Refs for stable callbacks
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});

  const handleSystemContactSearch = useCallback(
    async (type: "call" | "message" | "whatsapp", targetName: string) => {
      try {
        // 1. Try checking internal app contacts first
        const foundInternal = (settings.contacts || []).filter((c) =>
          c.name.toLowerCase().includes(targetName.toLowerCase()),
        );

        if (foundInternal.length === 1) {
          // Exact match
          const contact = foundInternal[0];

          const rawMsg = settings.advancedIntegrations
            ? `Initiating ${type} to ${contact.name} via system access.`
            : `I'm calling ${contact.name} now.`;

          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: rawMsg,
              timestamp: Date.now(),
            },
          ]);
          speak(rawMsg, settings.voiceId);

          // Execute immediately
          if (type === "call") {
            handleActionExecution("call", contact.number);
          } else {
            // For message, we might need content, but if none provided, just open SMS client
            handleActionExecution("message", contact.number);
          }
          return true;
        } else if (foundInternal.length > 1) {
          // Duplicates found
          const names = foundInternal.map((c) => c.name).join(" or ");
          const confirmMsg = `I found multiple matches: ${names}. Which one should I ${type}? [AWAITING_REPLY]`;
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: confirmMsg,
              timestamp: Date.now(),
            },
          ]);
          speak(
            confirmMsg.replace("[AWAITING_REPLY]", ""),
            settings.voiceId,
            () => {
              startListeningRef.current();
            },
          );
          return false;
        }

        // 2. Fallback to OS Contact Picker
        let inIframe = false;
        try {
          inIframe = window.self !== window.top;
        } catch (e) {
          inIframe = true;
        }

        if (inIframe) {
          const msg =
            "I need permission to search your contacts, but I'm currently running in a preview window. Please click the 'Open in new tab' button at the top right of the screen (near the URL) to enable this feature.";
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: msg,
              timestamp: Date.now(),
            },
          ]);
          speak(msg, settings.voiceId);
          return false;
        }

        const nav = navigator as any;
        if (nav.contacts && typeof nav.contacts.select === "function") {
          const props = ["name", "tel"];
          const opts = { multiple: false };

          const results = await nav.contacts.select(props, opts);

          if (results && results.length > 0) {
            const contact = results[0];
            const number =
              (Array.isArray(contact.tel) ? contact.tel[0] : contact.tel) || "";
            const name =
              (Array.isArray(contact.name) ? contact.name[0] : contact.name) ||
              targetName;

            if (number) {
              const rawMsg = settings.advancedIntegrations
                ? `I have retrieved ${name}'s identity from the system database. Shall I proceed with the ${type}? [AWAITING_REPLY]`
                : `Found ${name}. Shall I proceed with the ${type} to ${number}? [AWAITING_REPLY]`;

              const cleanMsg = rawMsg.replace("[AWAITING_REPLY]", "").trim();

              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: cleanMsg,
                  timestamp: Date.now(),
                },
              ]);
              speak(cleanMsg, settings.voiceId, () => {
                startListeningRef.current();
              });

              setPendingAction({
                type: type as "call" | "message",
                number,
                name,
                step: type === "message" ? "draft" : "confirm",
              });
              return true;
            }
          }
        } else {
          throw new Error("Contact Picker API not supported");
        }
      } catch (err: any) {
        console.warn("Contact search failed:", err);

        if (err.name === "AbortError") {
          // User cancelled, prompt for manual input
          const cancelMsg = `Search cancelled. What is the phone number you'd like to ${type}? [AWAITING_REPLY]`;
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: cancelMsg,
              timestamp: Date.now(),
            },
          ]);
          speak(cancelMsg, settings.voiceId, () => {
             startListeningRef.current();
          });
          setPendingAction({
            type: type as "call" | "message",
            step: "wait_number",
          });
        } else {
          const alertMsg =
            err.name === "SecurityError"
              ? "Your browser blocked contact access for security. Please open the app in a new tab."
              : `I couldn't access your contacts. What is the phone number you'd like to ${type}? [AWAITING_REPLY]`;

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: alertMsg,
              timestamp: Date.now(),
            },
          ]);
          if (err.name !== "SecurityError") {
            speak(alertMsg, settings.voiceId, () => {
              startListeningRef.current();
            });
            setPendingAction({
              type: type as "call" | "message",
              step: "wait_number",
            });
          } else {
            speak(alertMsg, settings.voiceId);
          }
        }
        return false;
      }
      return false;
    },
    [settings, handleActionExecution],
  );

  const openIntentUrl = useCallback((url: string) => {
    // Advanced Native Android Bridge Check (optimizes for Android Studio conversion)
    if (typeof window !== "undefined" && (window as any).Android && typeof (window as any).Android.openIntent === "function") {
      (window as any).Android.openIntent(url);
      return;
    }

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank"; // Use _blank to escape sandbox restrictions
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const executeSystemActionString = useCallback(
    async (actionStr?: string) => {
      if (!actionStr) return;
      // Normalize action markers (remove spaces before colons)
      let finalAction = actionStr.replace(/([A-Z_]+)\s+:/g, "$1:");

      // Handle the case where action string has extra text,
      // although TASK_TRACKER actions should ideally be clean.
      // But just in case, extract the core trigger block
      const extractActionCore = (marker: string) => {
        const parts = finalAction.split(marker);
        let val = parts[1]?.trim().split("\n")[0] || "";
        val = val.replace(/^["']|["']$/g, "").replace(/[*`]/g, "").trim();
        return val;
      };

      if (finalAction.includes("ACTION_CALL:")) {
        const contactName = extractActionCore("ACTION_CALL:");
        await handleSystemContactSearch("call", contactName);
      } else if (finalAction.includes("ACTION_MESSAGE:")) {
        const contactName = extractActionCore("ACTION_MESSAGE:");
        await handleSystemContactSearch("message", contactName);
      } else if (finalAction.includes("ACTION_WHATSAPP:")) {
        const contactName = extractActionCore("ACTION_WHATSAPP:");
        await handleSystemContactSearch("whatsapp", contactName);
      } else if (finalAction.includes("OPEN_APP:")) {
        const rawAppName = extractActionCore("OPEN_APP:");
        const appName = rawAppName.toLowerCase().replace(/\s/g, "");

        if (settings.androidMode) {
          const intentMap: Record<string, string> = {
            whatsapp:
              "intent://#Intent;package=com.whatsapp;scheme=whatsapp;end;",
            netflix: "intent://#Intent;package=com.netflix.mediaclient;end;",
            youtube: "intent://#Intent;package=com.google.android.youtube;end;",
            instagram: "intent://#Intent;package=com.instagram.android;end;",
            spotify: "intent://#Intent;package=com.spotify.music;end;",
            maps: "intent://#Intent;package=com.google.android.apps.maps;end;",
            gmail: "intent://#Intent;package=com.google.android.gm;end;",
            chrome: "intent://#Intent;package=com.android.chrome;end;",
            camera:
              "intent://#Intent;action=android.media.action.STILL_IMAGE_CAMERA;end;",
            settings: "intent://#Intent;action=android.settings.SETTINGS;end;",
            calendar:
              "intent://#Intent;package=com.google.android.calendar;end;",
            clock: "intent://#Intent;package=com.google.android.deskclock;end;",
            facebook: "intent://#Intent;package=com.facebook.katana;end;",
            twitter: "intent://#Intent;package=com.twitter.android;end;",
            x: "intent://#Intent;package=com.twitter.android;end;",
            telegram: "intent://#Intent;package=org.telegram.messenger;end;",
            calculator:
              "intent://#Intent;package=com.google.android.calculator;end;",
            photos:
              "intent://#Intent;package=com.google.android.apps.photos;end;",
            snapchat: "intent://#Intent;package=com.snapchat.android;end;",
            hotstar: "intent://#Intent;package=in.startv.hotstar;end;",
            prime:
              "intent://#Intent;package=com.amazon.avod.thirdpartyclient;end;",
            pubg: "intent://#Intent;package=com.tencent.ig;end;",
            bgmi: "intent://#Intent;package=com.pubg.imobile;end;",
          };

          if (intentMap[appName]) {
            openIntentUrl(intentMap[appName]);
          } else {
            openIntentUrl(
              `market://search?q=${encodeURIComponent(rawAppName)}`,
            );
          }
        } else {
          // Web Fallback
          const webMap: Record<string, string> = {
            whatsapp: `https://web.whatsapp.com/`,
            telegram: `https://web.telegram.org/`,
            instagram: `https://www.instagram.com/`,
            facebook: `https://www.facebook.com/`,
            twitter: `https://twitter.com/`,
            youtube: `aura://youtube/search?q=trending`,
            netflix: `aura://youtube/search?q=netflix+trailer`,
            prime: `aura://youtube/search?q=prime+video+trailer`,
            hotstar: `aura://youtube/search?q=hotstar+shows`,
            spotify: `https://open.spotify.com/`,
          };
          const appUrl =
            webMap[appName] ||
            `https://www.google.com/search?q=${encodeURIComponent(rawAppName)}&igu=1`;
          setBrowserUrl(appUrl);
        }
      } else if (finalAction.includes("UI_AUTOMATION:")) {
        const intentUri = extractActionCore("UI_AUTOMATION:");
        if (settings.androidMode) {
          openIntentUrl(intentUri);
        } else {
          let qMatch =
            intentUri.match(/q=([^#;&]+)/) ||
            intentUri.match(/query=([^#;&]+)/) ||
            intentUri.match(/search\/([^#;&]+)/);
          let query = qMatch ? decodeURIComponent(qMatch[1]) : "";

          if (
            intentUri.includes("youtube") ||
            intentUri.includes("netflix") ||
            intentUri.includes("hotstar") ||
            intentUri.includes("prime") ||
            intentUri.includes("spotify")
          ) {
            let suffix = "";
            if (intentUri.includes("netflix")) suffix = " movie scene";
            if (intentUri.includes("hotstar")) suffix = " episode";
            if (intentUri.includes("prime")) suffix = " prime video";
            const fullQuery = query ? `${query}${suffix}` : `trending${suffix}`;
            setBrowserUrl(
              `aura://youtube/play?q=${encodeURIComponent(fullQuery)}`,
            );
          } else if (query) {
            setBrowserUrl(
              `https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`,
            );
          } else {
            setBrowserUrl(
              `https://www.google.com/search?q=${encodeURIComponent(intentUri)}&igu=1`,
            );
          }
        }
      } else if (finalAction.includes("OPEN_APP_STORE:")) {
        const appName = extractActionCore("OPEN_APP_STORE:");
        if (settings.androidMode) {
          openIntentUrl(`market://search?q=${encodeURIComponent(appName)}`);
        } else {
          setBrowserUrl(
            `https://play.google.com/store/search?q=${encodeURIComponent(appName)}&c=apps`,
          );
        }
      } else if (finalAction.includes("OPEN_BROWSER:")) {
        let url = extractActionCore("OPEN_BROWSER:");
        url = url.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
        if (url && !url.includes("://") && !url.startsWith("aura://")) {
          url = "https://" + url;
        }
        setBrowserUrl(url);
      } else if (finalAction.includes("CLOSE_BROWSER")) {
        setBrowserUrl("");
      } else if (finalAction && finalAction !== "execute" && finalAction !== "system") {
        throw new Error(`Unhandled action format: ${finalAction}`);
      }
    },
    [settings.androidMode, openIntentUrl, handleSystemContactSearch],
  );

  const handleTextSubmit = useCallback(
    async (text: string, isVoice: boolean = false) => {
      setWasLastInputVoice(isVoice);
      wasLastInputVoiceRef.current = isVoice;
      if (!text.trim()) return;

      // Do not auto-close if we are playing a video/media, let the AI or User close it.
      if (
        browserUrl &&
        !browserUrl.includes("youtube") &&
        !browserUrl.includes("play")
      ) {
        setBrowserUrl(null);
      }

      stopListeningRef.current();
      if (beepEndRef.current) beepEndRef.current.play();

      const lowerText = text.toLowerCase().trim();

      // 0. Handle Confirmation for Pending Search
      if (pendingContactSearch) {
        const isYes =
          lowerText.includes("yes") ||
          lowerText.includes("sure") ||
          lowerText.includes("ok") ||
          lowerText.includes("yeah");
        const isNo =
          lowerText.includes("no") ||
          lowerText.includes("stop") ||
          lowerText.includes("cancel");

        if (isYes) {
          const searchType = pendingContactSearch.type as "call" | "message";
          const name = pendingContactSearch.name;
          setPendingContactSearch(null);
          await handleSystemContactSearch(searchType, name);
          return;
        } else if (isNo) {
          setPendingContactSearch(null);
          const msg = `No problem. I've cancelled the search.`;
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: msg,
              timestamp: Date.now(),
            },
          ]);
          speak(msg, settings.voiceId);
          return;
        }
      }

      // 0.1 Handle Pending Actions (Interactive Flows)
      if (pendingAction) {
        if (
          pendingAction.step === "confirm" ||
          pendingAction.step === "confirm_send"
        ) {
          const isYes =
            lowerText.includes("yes") ||
            lowerText.includes("sure") ||
            lowerText.includes("ok") ||
            lowerText.includes("yeah") ||
            lowerText.includes("send") ||
            lowerText.includes("dial") ||
            lowerText.includes("make the call");
          const isNo =
            lowerText.includes("no") ||
            lowerText.includes("stop") ||
            lowerText.includes("cancel") ||
            lowerText.includes("don't");

          if (isYes) {
            const successMsg =
              pendingAction.type === "call"
                ? `Initiating call to ${pendingAction.name}.`
                : `Opening message for ${pendingAction.name}.`;

            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "user",
                content: text,
                timestamp: Date.now(),
              },
            ]);
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: successMsg,
                timestamp: Date.now(),
              },
            ]);
            speak(successMsg, settings.voiceId, () => {
              if (settings.advancedIntegrations) startListeningRef.current();
            });
            handleActionExecution(
              pendingAction.type,
              pendingAction.number,
              pendingAction.content,
            );
            setPendingAction(null);
            return;
          } else if (isNo) {
            setPendingAction(null);
            const cancelMsg = "Alright, I've cancelled that for you.";
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "user",
                content: text,
                timestamp: Date.now(),
              },
            ]);
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: cancelMsg,
                timestamp: Date.now(),
              },
            ]);
            speak(cancelMsg, settings.voiceId, () => {
              if (settings.advancedIntegrations) startListeningRef.current();
            });
            return;
          }
        } else if (pendingAction.step === "draft") {
          // Input was the message content
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "user",
              content: text,
              timestamp: Date.now(),
            },
          ]);
          const rawConfirmMsg = `Got it. I've drafted "${text}" for ${pendingAction.name || 'this contact'}. Shall I send it now? [AWAITING_REPLY]`;
          const cleanConfirmMsg = rawConfirmMsg
            .replace("[AWAITING_REPLY]", "")
            .trim();

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: cleanConfirmMsg,
              timestamp: Date.now(),
            },
          ]);
          speak(cleanConfirmMsg, settings.voiceId, () => {
             startListeningRef.current(); // Always resume if waiting for reply
          });
          setPendingAction({
            ...pendingAction,
            step: "confirm_send",
            content: text,
          });
          return;
        } else if (pendingAction.step === "wait_number") {
          // Extract the number
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "user",
              content: text,
              timestamp: Date.now(),
            },
          ]);
          const numMatch = text.match(/(\\+?[\\d\\s-]{7,15})/);
          if (numMatch) {
            const number = numMatch[0].replace(/\\s/g, '');
            const rawConfirmMsg = `Got it. Shall I proceed with the ${pendingAction.type} to ${number}? [AWAITING_REPLY]`;
            const cleanConfirmMsg = rawConfirmMsg.replace("[AWAITING_REPLY]", "").trim();
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: cleanConfirmMsg,
                timestamp: Date.now(),
              },
            ]);
            speak(cleanConfirmMsg, settings.voiceId, () => {
              startListeningRef.current();
            });
            setPendingAction({
              ...pendingAction,
              number,
              name: number,
              step: pendingAction.type === "message" ? "draft" : "confirm",
            });
          } else {
            const numCancelMatch = text.match(/\\b(no|cancel|stop|forget)\\b/i);
            if (numCancelMatch) {
               const cancelMsg = "Alright, I've cancelled that.";
               setMessages((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), role: "assistant", content: cancelMsg, timestamp: Date.now() },
               ]);
               speak(cancelMsg, settings.voiceId);
               setPendingAction(null);
            } else {
               const retryMsg = "I couldn't detect a valid phone number. Please try saying the number again, or say cancel. [AWAITING_REPLY]";
               const cleanRetryMsg = retryMsg.replace("[AWAITING_REPLY]", "").trim();
               setMessages((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), role: "assistant", content: cleanRetryMsg, timestamp: Date.now() },
               ]);
               speak(cleanRetryMsg, settings.voiceId, () => {
                  startListeningRef.current();
               });
            }
          }
          return;
        }
      }

      // Add user message to UI
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      // 1. Try Local Brain first (Context & Intent aware)
      const localAction = parseLocalCommand(text, settings, messages);

      if (localAction.type !== "unknown") {
        // Intent handling: Confirmation
        if (localAction.type === "confirm") {
          if (pendingAction) {
            handleActionExecution(
              pendingAction.type,
              pendingAction.number,
              pendingAction.content,
            );
            const successMsg =
              pendingAction.type === "call"
                ? `Calling ${pendingAction.name}...`
                : `Sending message to ${pendingAction.name}...`;
            const assistantMsg: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: successMsg,
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setPendingAction(null);
            setIsProcessing(false);
            if (isVoice) speak(successMsg, settings.voiceId);
            return;
          } else if (pendingContactSearch) {
            handleSystemContactSearch(
              pendingContactSearch.type as any,
              pendingContactSearch.name,
            );
            setPendingContactSearch(null);
            setIsProcessing(false);
            return;
          }
        }

        // Intent handling: Cancellation
        if (localAction.type === "cancel") {
          setPendingAction(null);
          setPendingContactSearch(null);
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: localAction.response,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
          if (isVoice) speak(localAction.response, settings.voiceId);
          return;
        }

        let response = localAction.response;
        const isWaiting = response.includes("[AWAITING_REPLY]");
        const cleanResponse = response.replace("[AWAITING_REPLY]", "").trim();

        if (localAction.searchPhone) {
          const rawSearchMsg = settings.advancedIntegrations
               ? `Initiating system search protocols for ${localAction.payload.unknownName}...`
               : `Let me check your contacts for ${localAction.payload.unknownName}...`;
          
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: rawSearchMsg,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
          if (isVoice) {
            speak(rawSearchMsg, settings.voiceId, () => {
              handleSystemContactSearch(localAction.type as "call" | "message", localAction.payload.unknownName);
            });
          } else {
            handleSystemContactSearch(localAction.type as "call" | "message", localAction.payload.unknownName);
          }
          return;
        }

        if (localAction.type === "call" && localAction.payload?.number) {
          const number = localAction.payload.number;
          const name =
            localAction.payload.name ||
            (settings.contacts || []).find((c) => c.number === number)?.name ||
            number;

          const rawRes = settings.advancedIntegrations
            ? `I've accessed your device communications via advanced permissions. I'm ready to call ${name}. Should I proceed with the dial? [AWAITING_REPLY]`
            : `I've found the number for ${name}. Should I initiate the call now? [AWAITING_REPLY]`;

          const finalClean = rawRes.replace("[AWAITING_REPLY]", "").trim();

          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: finalClean,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
          if (isVoice) {
            speak(finalClean, settings.voiceId, () => {
              startListeningRef.current();
            });
          }

          setPendingAction({ type: "call", number, name, step: "confirm" });
          return;
        }

        if (localAction.type === "message" && localAction.payload?.number) {
          const number = localAction.payload.number;
          const name =
            localAction.payload.name ||
            (settings.contacts || []).find((c) => c.number === number)?.name ||
            number;
          const content = localAction.payload.content;

          let rawRes = localAction.response;
          if (settings.advancedIntegrations) {
            rawRes = content
              ? `Using advanced system access, I have drafted your message to ${name}. Shall I transmit it now? [AWAITING_REPLY]`
              : `Sure thing. I'm connected to your system messaging. What would you like me to type for ${name}? [AWAITING_REPLY]`;
          }

          const finalClean = rawRes.replace("[AWAITING_REPLY]", "").trim();
          const waitingForMsg = rawRes.includes("[AWAITING_REPLY]");

          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: finalClean,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
          if (isVoice) {
            speak(finalClean, settings.voiceId, () => {
              if (waitingForMsg) startListeningRef.current();
            });
          }

          setPendingAction({
            type: "message",
            number,
            name,
            step: content ? "confirm_send" : "draft",
            content,
          });
          return;
        }

        if (localAction.type === "task" && localAction.payload?.steps) {
          const task = { steps: localAction.payload.steps, currentIndex: 0 };
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: cleanResponse,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
          if (isVoice) speak(cleanResponse, settings.voiceId);

          // Start the task
          setCurrentTask(task);
          executeNextTaskStep(task);
          return;
        }

        if (localAction.type === "system") {
          const action = localAction.payload?.action;
          if (action === "clear_history") {
            setMessages([]);
            const assistantMsg: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: localAction.response,
              timestamp: Date.now(),
            };
            setMessages([assistantMsg]);
          } else if (action === "stop_audio") {
            stopSpeaking();
          }
          setIsProcessing(false);
          if (isVoice) speak(localAction.response, settings.voiceId);
          return;
        }

        if (localAction.type === "open" && localAction.payload?.url) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: cleanResponse,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsProcessing(false);
          if (isVoice) speak(cleanResponse, settings.voiceId);
          window.open(localAction.payload.url, "_blank");
          return;
        }

        // Fallback for time/date
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: cleanResponse,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsProcessing(false);
        if (isVoice) speak(cleanResponse, settings.voiceId);
        return;
      }

      // 2. Cloud Engine fallback
      const history = messages.slice(-40); // keep larger context for better memory
      const responseText = await processWithCloudEngine(
        text,
        settings,
        history,
        memory,
      );

      // Parse trigger commands
      let cleanResponse = (responseText || "").replace(/([A-Z_]+)\s+:/g, "$1:");
      let actionTriggered = false;
      let awaitingReply = false;

      // Find JSON block after a given index
      const extractJsonFromIndex = (text: string, startIndex: number) => {
        const firstBrace = text.indexOf("{", startIndex);
        if (firstBrace === -1) return null;

        let braceCount = 0;
        let inString = false;
        let escape = false;

        for (let i = firstBrace; i < text.length; i++) {
          const char = text[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (char === "\\") {
            escape = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === "{") braceCount++;
            else if (char === "}") {
              braceCount--;
              if (braceCount === 0) {
                return {
                  jsonStr: text.substring(firstBrace, i + 1),
                  endIndex: i + 1,
                };
              }
            }
          }
        }
        return null;
      };

      if (cleanResponse.includes("MEMORY_SAVE:")) {
        try {
          const prefixIndex = cleanResponse.indexOf("MEMORY_SAVE:");
          const jsonMatch = extractJsonFromIndex(cleanResponse, prefixIndex);
          if (jsonMatch) {
            const memoryData = JSON.parse(jsonMatch.jsonStr);
            saveMemory(memoryData);
            cleanResponse = cleanResponse.replace(
              cleanResponse.substring(prefixIndex, jsonMatch.endIndex),
              ""
            ).trim();
          }
        } catch (e) {
          console.error("Failed to parse MEMORY_SAVE", e);
        }
      }

      if (cleanResponse.includes("[AWAITING_REPLY]")) {
        awaitingReply = true;
        cleanResponse = cleanResponse.replace("[AWAITING_REPLY]", "").trim();
      }

      let hasTrackerData = false;
      let jsonToParse = null;

      const taskTrackerRegex = /\*?\*?TASK_TRACKER\*?\*?:?\s*/i;
      const trackerMatch = cleanResponse.match(taskTrackerRegex);

      if (trackerMatch && trackerMatch.index !== undefined) {
        const jsonMatch = extractJsonFromIndex(cleanResponse, trackerMatch.index);
        if (jsonMatch) {
           jsonToParse = jsonMatch.jsonStr;
           
           let startIdx = trackerMatch.index;
           // If there is ```json before the TASK_TRACKER, try to remove it too
           const beforeString = cleanResponse.substring(0, startIdx);
           if (beforeString.match(/```(json)?\s*$/)) {
               const bMatch = beforeString.match(/```(json)?\s*$/);
               if (bMatch && bMatch.index !== undefined) {
                   startIdx = bMatch.index;
               }
           }
           
           let sliceEnd = jsonMatch.endIndex;
           const trailingMatch = cleanResponse.substring(sliceEnd).match(/^\s*```/);
           if (trailingMatch) {
               sliceEnd += trailingMatch[0].length;
           }

           cleanResponse = cleanResponse.replace(
             cleanResponse.substring(startIdx, sliceEnd),
             ""
           ).trim();
        }
      } 
      
      if (!jsonToParse) {
        const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?"goal"[\s\S]*?"steps"[\s\S]*?\})\s*```/i;
        const rawJsonBlockRegex = /(\{[\s\S]*?"goal"[\s\S]*?"steps"[\s\S]*?\})/i;
        const codeBlockMatch = cleanResponse.match(jsonBlockRegex);
        
        if (codeBlockMatch) {
          jsonToParse = codeBlockMatch[1];
          cleanResponse = cleanResponse.replace(codeBlockMatch[0], "").trim();
        } else {
          const rawMatch = cleanResponse.match(rawJsonBlockRegex);
          if (rawMatch) {
             const jsonMatch = extractJsonFromIndex(rawMatch[0], 0);
             if (jsonMatch) {
               jsonToParse = jsonMatch.jsonStr;
               cleanResponse = cleanResponse.replace(jsonMatch.jsonStr, "").trim();
             }
          }
        }
        
        // Remove left-over TASK_TRACKER indicator if it exists
        cleanResponse = cleanResponse.replace(/\*?\*?TASK_TRACKER\*?\*?:?\s*$/i, "").trim();
      }

      if (jsonToParse) {
        try {
          const trackerData = JSON.parse(jsonToParse);
          if (trackerData && trackerData.goal && trackerData.steps) {
            setActiveTaskTracker(trackerData);
            hasTrackerData = true;
          }
        } catch (e) {
          console.error("Failed to parse task tracker JSON", e);
        }
      }

      if (cleanResponse.includes("CLEAR_TASK_TRACKER")) {
        setActiveTaskTracker(null);
        hasTrackerData = false;
        cleanResponse = cleanResponse.replace("CLEAR_TASK_TRACKER", "").trim();
      }

      const executeOrQueue = (action: () => void) => {
        if (hasTrackerData) {
          // If Task Tracker is active, it handles step execution internally via onExecuteAction
          // No need to queue redundant full-response standalone triggers
          return;
        } else {
          action();
        }
      };

      // Strip ALL uppercase commands with colons from being spoken/shown.
      // But we still process them.
      let displayResponse = cleanResponse;
      displayResponse = displayResponse
        .replace(/[A-Z_]+\s*:(.*?)(?=\n|$)/g, "")
        .trim();
      // Also strip any leftover code blocks just in case
      displayResponse = displayResponse.replace(/```[\s\S]*?```/g, "").trim();

      const matchAndExecuteRegex = (
        actionRegex: RegExp,
        actionType: string,
      ) => {
        const match = cleanResponse.match(actionRegex);
        if (match) {
          const payload = match[1].trim();
          const actionStr = `${actionType}${payload}`;
          executeOrQueue(() => {
            executeSystemActionString(actionStr);
          });
          return true;
        }
        return false;
      };

      matchAndExecuteRegex(/\*?\*?ACTION_CALL\*?\*?\s*:\s*(.*)/i, "ACTION_CALL:");
      matchAndExecuteRegex(/\*?\*?ACTION_MESSAGE\*?\*?\s*:\s*(.*)/i, "ACTION_MESSAGE:");
      matchAndExecuteRegex(/\*?\*?ACTION_WHATSAPP\*?\*?\s*:\s*(.*)/i, "ACTION_WHATSAPP:");
      matchAndExecuteRegex(/\*?\*?OPEN_APP\*?\*?\s*:\s*(.*)/i, "OPEN_APP:");
      matchAndExecuteRegex(/\*?\*?UI_AUTOMATION\*?\*?\s*:\s*(.*)/i, "UI_AUTOMATION:");
      matchAndExecuteRegex(/\*?\*?OPEN_APP_STORE\*?\*?\s*:\s*(.*)/i, "OPEN_APP_STORE:");

      const triggerCallMatch = cleanResponse.match(/\*?\*?TRIGGER_CALL\*?\*?\s*:\s*(.*)/i);
      if (triggerCallMatch) {
        const num = triggerCallMatch[1].trim();
        const confirmMsg = `${displayResponse} Initiating dial...`;
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: confirmMsg,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsProcessing(false);
        if (isVoice) speak(confirmMsg, settings.voiceId);

        handleActionExecution("call", num);
        return;
      }

      const triggerMessageMatch = cleanResponse.match(
        /\*?\*?TRIGGER_MESSAGE\*?\*?\s*:\s*(.*)/i,
      );
      if (triggerMessageMatch) {
        const num = triggerMessageMatch[1].trim();
        const confirmMsg = `${displayResponse} Opening message editor...`;
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: confirmMsg,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsProcessing(false);
        if (isVoice) speak(confirmMsg, settings.voiceId);

        handleActionExecution("message", num);
        return;
      }

      const triggerWhatsappMatch = cleanResponse.match(
        /\*?\*?TRIGGER_WHATSAPP\*?\*?\s*:\s*(.*)/i,
      );
      if (triggerWhatsappMatch) {
        const num = triggerWhatsappMatch[1].trim();
        const confirmMsg = `${displayResponse} Opening WhatsApp...`;
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: confirmMsg,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsProcessing(false);
        if (isVoice) speak(confirmMsg, settings.voiceId);

        handleActionExecution("whatsapp", num);
        return;
      }

      const openBrowserMatch = cleanResponse.match(/\*?\*?OPEN_BROWSER\*?\*?\s*:\s*(.*)/i);
      if (openBrowserMatch) {
        let url = openBrowserMatch[1].trim();
        url = url.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
        if (url && !url.includes("://") && !url.startsWith("aura://")) {
          url = "https://" + url;
        }
        setBrowserUrl(url);
      } else if (cleanResponse.match(/\*?\*?CLOSE_BROWSER\*?\*?/i)) {
        displayResponse = displayResponse.replace(/\*?\*?CLOSE_BROWSER\*?\*?/gi, "").trim();
        setBrowserUrl(null);
      }

      setIsProcessing(false);

      if (displayResponse) {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: displayResponse,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (isVoice) {
          speak(displayResponse, settings.voiceId, () => {
            // Advanced Integrations: Automatically re-enable listening for hands-free automation
            if (settings.advancedIntegrations && !actionTriggered) {
              startListeningRef.current();
            } else if (!actionTriggered && awaitingReply) {
              startListeningRef.current();
            }
          });
        }
      } else {
        // Even if displayResponse is empty, we must restart listening if awaiting reply
        if (
          isVoice &&
          settings.advancedIntegrations &&
          !actionTriggered &&
          awaitingReply
        ) {
          startListeningRef.current();
        }
      }
    },
    [settings, messages, speak],
  );

  const handleResult = useCallback(
    async (transcript: string, isFinal: boolean) => {
      if (!isFinal) return; // We only process final sentences
      if (!transcript) return;

      let processedText = transcript.trim().toLowerCase();

      if (!processedText) return;

      handleTextSubmit(processedText, true);
    },
    [handleTextSubmit],
  );

  const {
    isListening,
    startListening,
    stopListening,
    error,
    supported: srSupported,
  } = useSpeechRecognition({
    language: settings.language,
    onResult: handleResult,
    continuous: false,
    onAudioStart: () => {
      if (beepStartRef.current) beepStartRef.current.play();
    },
  });

  // Handle speech recognition errors visually
  useEffect(() => {
    if (error === "not-allowed") {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I need microphone access to hear you. Please ensure microphone permissions are allowed. If you're in a restricted preview window, click 'Open in new tab' at the top right of the screen.",
          timestamp: Date.now(),
        },
      ]);
    } else if (error === "network") {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I'm having trouble connecting to the speech recognition service. Please check your internet connection or try again later.",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [error]);

  // Assign stable listeners to refs
  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListening;
  }, [startListening, stopListening]);

  // Auto-start listening if wake word is enabled
  useEffect(() => {
    // Disabled auto-start to prevent 'not-allowed' errors in iframes or strictly permissioned browsers.
    // The user MUST tap the microphone button directly to intialize it first.
    if (!srSupported) {
      stopListening();
    }
  }, [srSupported, stopListening]);

  const handleToggleListen = () => {
    if (isListening) {
      stopListening();
      if (beepEndRef.current) beepEndRef.current.play();
    } else {
      stopSpeaking();
      startListening();
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-900 text-white select-none">
      {showSettings ? (
        <Settings
          settings={settings}
          voices={voices}
          onSave={(newSet) => {
            setSettings(newSet);
            localStorage.setItem("visionVoiceSettings", JSON.stringify(newSet));
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
          onTestVoice={(text, vId, gender) => {
            speak(text, vId);
          }}
        />
      ) : showStats ? (
        <UsageStats messages={messages} onClose={() => setShowStats(false)} />
      ) : (
        <div className="flex flex-col h-full w-full overflow-hidden relative">
          <AnimatePresence>
            {activeTaskTracker && (
              <TaskTracker
                key={activeTaskTracker.goal + activeTaskTracker.steps.length}
                goal={activeTaskTracker.goal}
                steps={activeTaskTracker.steps}
                onCancel={() => {
                  setActiveTaskTracker(null);
                  speak("Task cancelled.");
                  // Reset tracking states to stop processing
                  setIsProcessing(false);
                  setQueuedSystemAction(null);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      role: "user",
                      content: "Cancel the task.",
                      timestamp: Date.now(),
                    },
                  ]);
                }}
                onDismiss={() => {
                  setActiveTaskTracker(null);
                }}
                onComplete={() => {
                  if (queuedSystemAction) {
                    queuedSystemAction();
                    setQueuedSystemAction(null);
                  }
                  
                  // Speak completion if it was a voice command
                  if (wasLastInputVoiceRef.current) {
                    speak("Task completed.");
                  }
                  
                  // Add a completion message if we were tracking an active task
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      role: "system",
                      content: "✅ Task successfully completed.",
                      timestamp: Date.now(),
                    },
                  ]);

                  setTimeout(() => {
                    setActiveTaskTracker(null);
                  }, 2000);
                }}
                onExecuteAction={executeSystemActionString}
              />
            )}
          </AnimatePresence>

          {isAssistantSetupOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-800 border border-slate-700/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
              >
                <div className="p-4 border-b border-slate-700 font-semibold flex items-center justify-between">
                  <span>Android Default Assistant Setup</span>
                  <button
                    onClick={() => setIsAssistantSetupOpen(false)}
                    className="text-slate-400 hover:text-white pb-1 w-6 h-6 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4 space-y-4 text-sm text-slate-300 max-h-[70vh] overflow-y-auto">
                  <p>
                    To use this application natively as your Default Digital
                    Assistant (replacing Google Assistant), you must compile it
                    as a native Android APK using Capacitor or Android Studio.
                  </p>

                  <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                    <h3 className="text-white font-medium">
                      1. Add VoiceInteractionService
                    </h3>
                    <p>
                      In your AndroidManifest.xml, inside the
                      &lt;application&gt; tag:
                    </p>
                    <code className="block bg-black p-2 rounded text-blue-300 text-xs mt-2 overflow-x-auto whitespace-pre">
                      {`<service android:name=".MyAssistantService"
            android:permission="android.permission.BIND_VOICE_INTERACTION"
            android:exported="true">
            <meta-data android:name="android.voice_interaction"
                       android:resource="@xml/assistant_config" />
            <intent-filter>
                <action android:name="android.service.voice.VoiceInteractionService" />
            </intent-filter>
        </service>`}
                    </code>
                  </div>

                  <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                    <h3 className="text-white font-medium">
                      2. Trigger the Layout
                    </h3>
                    <p>
                      When the user holds the Home button, Android triggers
                      `onShow()`. Start the transparent React WebView layered
                      over the current screen:
                    </p>
                    <code className="block bg-black p-2 rounded text-blue-300 text-xs mt-2 overflow-x-auto whitespace-pre">
                      {`// Inject intent to transparent PWA Activity
Intent intent = new Intent(this, MainActivity.class);
intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
startActivity(intent);`}
                    </code>
                  </div>

                  <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                    <h3 className="text-white font-medium">
                      3. Inject Permission Bridge
                    </h3>
                    <p>
                      To hook up the native permission toggles in settings,
                      inject a JavascriptInterface:
                    </p>
                    <code className="block bg-black p-2 rounded text-emerald-300 text-xs mt-2 overflow-x-auto whitespace-pre">
                      {`class WebAppInterface {
    @JavascriptInterface
    public boolean requestPermission(String perm) {
        // Implement ActivityCompat.requestPermissions logic
        return true;
    }
}
webView.addJavascriptInterface(new WebAppInterface(), "Android");`}
                    </code>
                  </div>

                  <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-4">
                    <h3 className="text-white font-medium">
                      4. Hardware Triggers (Built-in)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Aura responds to a deliberate **Double Shake** or **Native Assistant** buttons (Power/Side). Gentle movements are ignored to prevent pocket activation.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button 
                        onClick={() => {
                          setIsAssistantSetupOpen(false);
                          // Double shake stimulation
                          setTimeout(() => handleAssistantTrigger("shake"), 300);
                        }}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-xs font-medium flex items-center gap-2"
                      >
                        <span>📳 Simulate Double Shake</span>
                      </button>
                      <button 
                        onClick={() => {
                          setIsAssistantSetupOpen(false);
                          setTimeout(() => handleAssistantTrigger("native"), 300);
                        }}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-xs font-medium flex items-center gap-2"
                        title="Simulates a native Android OS level assistant call"
                      >
                        <span>🔘 OS Assistant (Bridge)</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 pt-2 border-t border-slate-700">
                    Because this is currently running in a web browser, we
                    cannot bind OS-level assistant triggers. Compile using \`npx
                    cap add android\` to bind intents!
                  </p>
                </div>
                <div className="p-4 bg-slate-900/50 flex justify-end gap-3 border-t border-slate-700">
                  <button
                    onClick={() => setIsAssistantSetupOpen(false)}
                    className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 font-medium"
                  >
                    Got it
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          <AnimatePresence>
            {browserUrl && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "min(60vh, 500px)", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="shrink-0 w-full z-40 relative md:shadow-2xl overflow-hidden bg-white dark:bg-black border-b border-slate-700/50"
              >
                <BrowserModule
                  url={browserUrl}
                  onClose={() => setBrowserUrl(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-hidden relative">
            <ChatHistoryPanel
              isOpen={isHistoryPanelOpen}
              onClose={() => setIsHistoryPanelOpen(false)}
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={(id) => {
                setCurrentSessionId(id);
                setIsHistoryPanelOpen(false);
              }}
              onDeleteSession={deleteSession}
              onNewSession={() => {
                createNewSession();
                setIsHistoryPanelOpen(false);
              }}
              onClearAll={() => {
                clearAllSessions();
                setIsHistoryPanelOpen(false);
              }}
            />
            <AssistantUI
              settings={settings}
              onOpenSettings={() => setShowSettings(true)}
              onOpenHistory={() => setIsHistoryPanelOpen(true)}
              onOpenStats={() => setShowStats(true)}
              isListening={isListening}
              isProcessing={isProcessing}
              isSpeaking={isSpeaking}
              messages={messages}
              onToggleListen={handleToggleListen}
              onStopSpeaking={stopSpeaking}
              onSendText={(text) => handleTextSubmit(text, false)}
              onOpenAssistantSetup={() => setIsAssistantSetupOpen(true)}
              onEditMessage={(id, newContent) => {
                setMessages((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, content: newContent } : m))
                );
              }}
              onDeleteMessage={(id) => {
                setMessages((prev) => prev.filter((m) => m.id !== id));
              }}
              onSearchWeb={(query) => {
                setBrowserUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`);
              }}
              onLinkClick={(url) => window.open(url, "_blank")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
