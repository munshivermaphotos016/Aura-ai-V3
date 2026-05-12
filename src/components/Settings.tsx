import React, { useState, useRef } from "react";
import {
  X,
  Save,
  Shield,
  Volume2,
  Mic,
  Plus,
  Trash2,
  Edit2,
  Check,
  Globe,
  Users,
  Download,
  Eye,
} from "lucide-react";
import { AssistantSettings, ApiProvider, Contact } from "../types";
import { requestNativePermission, isNativeAndroid } from "../lib/nativeBridge";
import { generateId } from "../lib/ids";

interface SettingsProps {
  settings: AssistantSettings;
  onSave: (newSettings: AssistantSettings) => void;
  onClose: () => void;
  voices: SpeechSynthesisVoice[];
  onTestVoice?: (
    text: string,
    voiceId?: string,
    gender?: "male" | "female" | "custom",
  ) => void;
}

export function Settings({
  settings,
  onSave,
  onClose,
  voices,
  onTestVoice,
}: SettingsProps) {
  const [formData, setFormData] = useState<AssistantSettings>(settings);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [editingProvider, setEditingProvider] =
    useState<Partial<ApiProvider> | null>(null);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(
    null,
  );
  
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState("");
  const [modelFetchSuccess, setModelFetchSuccess] = useState("");

  const presetProviders = [
    { name: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
    { name: "Together AI", baseUrl: "https://api.together.xyz/v1" },
    { name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
    { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
    { name: "Cloudflare", baseUrl: "https://api.cloudflare.com/client/v4/accounts/<YOUR_ACCOUNT_ID>/ai/v1" },
  ];

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startCloningTimer = () => {
    setRecordingSeconds(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => {
        if (prev >= 10) {
          stopRecording();
          return 10;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleAddProvider = () => {
    setEditingProvider({
      id: generateId(),
      name: "",
      baseUrl: "",
      apiKey: "",
      modelName: "",
    });
    setAvailableModels([]);
    setModelFetchError("");
    setModelFetchSuccess("");
  };

  const fetchModelsList = async () => {
    if (!editingProvider?.baseUrl || !editingProvider?.apiKey) {
      setModelFetchError("Base URL and API Key are required.");
      return;
    }
    
    // Cloudflare requires a special URL format and doesn't easily support generic /models endpoint.
    if (editingProvider.baseUrl.includes("cloudflare.com")) {
      setModelFetchError("Auto-fetch not available for Cloudflare. Please enter model name manually (e.g. @cf/meta/llama-3-8b-instruct).");
      return;
    }

    setIsFetchingModels(true);
    setModelFetchError("");
    setModelFetchSuccess("");
    setAvailableModels([]);

    try {
      let url = editingProvider.baseUrl;
      if (!url.endsWith("/models")) {
        url = url.endsWith("/") ? url + "models" : url + "/models";
      }

      const response = await fetch("/api/llm-models-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          headers: {
            Authorization: "Bearer " + editingProvider.apiKey
          }
        })
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.json();
      if (data && data.data && Array.isArray(data.data)) {
        setAvailableModels(data.data.map((m: any) => m.id));
        setModelFetchSuccess("Found " + data.data.length + " models!");
      } else {
        throw new Error("Invalid format from provider");
      }
    } catch (error: any) {
      setModelFetchError("Failed to fetch models: " + error.message);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSaveProvider = () => {
    if (!editingProvider) return;
    const newProviders = [...(formData.customProviders || [])];
    const index = newProviders.findIndex((p) => p.id === editingProvider.id);

    if (index >= 0) {
      newProviders[index] = editingProvider as ApiProvider;
    } else {
      newProviders.push(editingProvider as ApiProvider);
    }

    setFormData({ ...formData, customProviders: newProviders });
    setEditingProvider(null);
  };

  const handleDeleteProvider = (id: string) => {
    const newProviders = (formData.customProviders || []).filter(
      (p) => p.id !== id,
    );
    let selectedId = formData.selectedProviderId;
    if (selectedId === id) selectedId = "default";
    setFormData({
      ...formData,
      customProviders: newProviders,
      selectedProviderId: selectedId,
    });
  };

  const handleAddContact = () => {
    setEditingContact({ id: generateId(), name: "", number: "" });
  };

  const handleSaveContact = () => {
    if (!editingContact) return;
    const newContacts = [...(formData.contacts || [])];
    const index = newContacts.findIndex((c) => c.id === editingContact.id);

    if (index >= 0) {
      newContacts[index] = editingContact as Contact;
    } else {
      newContacts.push(editingContact as Contact);
    }

    setFormData({ ...formData, contacts: newContacts });
    setEditingContact(null);
  };

  const handleDeleteContact = (id: string) => {
    const newContacts = (formData.contacts || []).filter((c) => c.id !== id);
    setFormData({ ...formData, contacts: newContacts });
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          const reader = new FileReader();
          reader.onload = (ev) => {
            setFormData({
              ...formData,
              ttsEngine: {
                ...formData.ttsEngine,
                cloneAudioBase64: ev.target?.result as string,
              },
            });
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        startCloningTimer();
      } catch (err) {
        console.error("Mic access denied", err);
      }
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-900 border-l border-slate-700 z-50 flex flex-col overflow-y-auto w-full max-w-full">
      <header className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900 sticky top-0">
        <h2 className="text-2xl font-semibold text-white">Settings</h2>
        <button
          onClick={onClose}
          className="p-3 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 focus:ring-4 focus:ring-blue-500 outline-none"
          aria-label="Close Settings"
        >
          <X size={24} />
        </button>
      </header>

      <div className="p-6 space-y-10 text-slate-200">
        {/* General Settings */}
        <section className="space-y-4">
          <h3 className="text-xl font-medium text-blue-400 border-b border-slate-700 pb-2">
            General
          </h3>

          <div>
            <label
              htmlFor="language"
              className="block text-lg mb-2 font-medium"
            >
              Assistant Input Language
            </label>
            <select
              id="language"
              className="w-full p-4 bg-slate-800 border border-slate-600 rounded-xl text-lg focus:ring-4 focus:ring-blue-500 outline-none"
              value={formData.language}
              onChange={(e) =>
                setFormData({ ...formData, language: e.target.value as any })
              }
            >
              <option value="en-US">English (US)</option>
              <option value="en-IN">English (India)</option>
              <option value="hi-IN">Hindi / Hinglish</option>
            </select>
          </div>

          <div>
            <label htmlFor="voice" className="block text-lg mb-2 font-medium">
              Assistant Voice
            </label>
            <div className="flex gap-2">
              <select
                id="voice"
                className="flex-1 p-4 bg-slate-800 border border-slate-600 rounded-xl text-lg focus:ring-4 focus:ring-blue-500 outline-none"
                value={formData.voiceId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, voiceId: e.target.value })
                }
              >
                <option value="">Auto-Detect via Output Language</option>
                {voices.map((v, i) => (
                  <option
                    key={`${v.voiceURI}-${v.name}-${i}`}
                    value={v.voiceURI}
                  >
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  onTestVoice?.(
                    "Hello, this is a test of my new voice. How do I sound?",
                    formData.voiceId,
                    formData.ttsEngine.voiceGender,
                  )
                }
                className="p-4 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-blue-400 focus:ring-4 focus:ring-blue-500 outline-none transition-colors"
                title="Test Voice"
              >
                <Volume2 size={24} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <input
              type="checkbox"
              id="webSearchEnabled"
              className="w-8 h-8 rounded text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600 cursor-pointer"
              checked={formData.webSearchEnabled}
              onChange={(e) =>
                setFormData({ ...formData, webSearchEnabled: e.target.checked })
              }
            />
            <div className="flex-1">
              <label
                htmlFor="webSearchEnabled"
                className="text-lg font-medium block"
              >
                Enable Web Search Grounding
              </label>
              <p className="text-sm text-slate-400">
                Allows default Gemini engine to use Google Search for the latest
                accurate information.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <input
              type="checkbox"
              id="wakeWordEnabled"
              className="w-8 h-8 rounded text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600"
              checked={formData.wakeWordEnabled}
              onChange={(e) =>
                setFormData({ ...formData, wakeWordEnabled: e.target.checked })
              }
            />
            <label
              htmlFor="wakeWordEnabled"
              className="text-lg font-medium flex-1 text-slate-100"
            >
              Enable Wake Word
            </label>
          </div>

          <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <input
              type="checkbox"
              id="hardwareTriggerEnabled"
              className="w-8 h-8 rounded text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600 cursor-pointer"
              checked={formData.hardwareTriggerEnabled}
              onChange={(e) =>
                setFormData({ ...formData, hardwareTriggerEnabled: e.target.checked })
              }
            />
            <div className="flex-1">
              <label
                htmlFor="hardwareTriggerEnabled"
                className="text-lg font-medium block text-slate-100"
              >
                Enable Double Shake Trigger
              </label>
              <p className="text-sm text-slate-400">
                Activate Aura by deliberately double-shaking your phone.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <input
              type="checkbox"
              id="powerButtonTriggerEnabled"
              className="w-8 h-8 rounded text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600 cursor-pointer"
              checked={formData.powerButtonTriggerEnabled}
              onChange={(e) =>
                setFormData({ ...formData, powerButtonTriggerEnabled: e.target.checked })
              }
            />
            <div className="flex-1">
              <label
                htmlFor="powerButtonTriggerEnabled"
                className="text-lg font-medium block text-slate-100"
              >
                Enable Power Button Trigger
              </label>
              <p className="text-sm text-slate-400">
                Activate Aura by double-clicking the side power button (requires Native APK).
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                id="advancedIntegrations"
                className="w-8 h-8 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-700 border-slate-600 cursor-pointer"
                checked={formData.advancedIntegrations}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    advancedIntegrations: e.target.checked,
                  })
                }
              />
              <div className="flex-1">
                <label
                  htmlFor="advancedIntegrations"
                  className="text-lg font-medium flex items-center gap-2"
                >
                  <Shield size={20} className="text-emerald-400" /> Advanced
                  System Permissions
                </label>
                <p className="text-sm text-slate-400 mt-1">
                  Eables deep-link integration for Android/iOS commands.
                  Required for hands-free calling, messaging, and multi-step
                  device automation.
                </p>
              </div>
            </div>

            {formData.advancedIntegrations && (
              <div className="text-xs text-amber-400/80 bg-amber-400/5 p-3 rounded-lg border border-amber-400/20">
                <p className="font-semibold mb-1 uppercase">
                  Note for Handicapped/Blind Users:
                </p>
                <p>
                  For absolute hands-free experience (Zero-Click Sending),
                  please download the Aura Native App from our portal. Web
                  versions are restricted by browser security to "Single-Tap"
                  confirmation only.
                </p>
              </div>
            )}
          </div>

          {formData.wakeWordEnabled && (
            <div>
              <label
                htmlFor="wakeWord"
                className="block text-lg mb-2 font-medium"
              >
                Wake Word
              </label>
              <input
                type="text"
                id="wakeWord"
                className="w-full p-4 bg-slate-800 border border-slate-600 rounded-xl text-lg focus:ring-4 focus:ring-blue-500 outline-none"
                value={formData.wakeWord}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    wakeWord: e.target.value.toLowerCase(),
                  })
                }
              />
            </div>
          )}
        </section>

        {/* Android Native Mode & Permissions */}
        <section className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-medium text-purple-400 flex items-center gap-2">
              <Shield size={20} /> System Permissions
            </h3>
            <button
              type="button"
              onClick={async () => {
                const perms = ["audio", "contacts", "call", "sms", "apps", "accessibility", "overlay"];
                const newPerms = { ...formData.permissions };
                for (const p of perms) {
                  if (!newPerms[p]) {
                    newPerms[p] = await requestNativePermission(p);
                  }
                }
                setFormData({ ...formData, permissions: newPerms });
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Request All Permissions
            </button>
          </div>

          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                id="androidMode"
                className="w-8 h-8 rounded text-purple-600 focus:ring-purple-500 bg-slate-700 border-slate-600 cursor-pointer"
                checked={formData.androidMode !== false} // default true in logic
                onChange={(e) =>
                  setFormData({ ...formData, androidMode: e.target.checked })
                }
              />
              <div className="flex-1">
                <label
                  htmlFor="androidMode"
                  className="text-lg font-medium flex items-center gap-2"
                >
                  Native Android Intents
                </label>
                <p className="text-sm text-slate-400 mt-1">
                  If enabled, opening apps will attempt to use native Android
                  app deep links (e.g. intent://) instead of rendering them in
                  the web view.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(
              formData.permissions || {
                audio: false,
                contacts: false,
                call: false,
                sms: false,
                apps: false,
                accessibility: false,
                overlay: false,
              },
            ).map(([perm, val]) => (
              <div
                key={perm}
                className="flex items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700"
              >
                <input
                  type="checkbox"
                  id={`perm-${perm}`}
                  className="w-6 h-6 rounded text-blue-600 bg-slate-700 border-slate-600"
                  checked={val}
                  onChange={async (e) => {
                    const isChecked = e.target.checked;
                    let allowed = isChecked;

                    // Only request permission if trying to turn it ON
                    if (isChecked) {
                      allowed = await requestNativePermission(perm);
                    }

                    if (allowed !== isChecked && isChecked) {
                      // The user denied the permission prompt
                      e.preventDefault();
                      return;
                    }

                    setFormData({
                      ...formData,
                      permissions: {
                        ...(formData.permissions || {}),
                        [perm]: allowed,
                      },
                    });
                  }}
                />
                <div className="flex-1 capitalize font-medium">
                  {perm} Access
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-400 mt-4 space-y-2 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="font-semibold text-blue-400">
              Native APK Integration Details:
            </p>
            {isNativeAndroid() ? (
              <p className="text-emerald-400 flex items-center gap-1">
                <Shield size={14} /> Android Native Bridge Connected
              </p>
            ) : (
              <p className="text-amber-400">
                ⚠️ Running in Web Mode. To get actual deep Android system
                permissions, you must inject the JavascriptInterface in your
                Android WebView app.
              </p>
            )}
            <p>
              In your Android Studio project, you must implement the{" "}
              <code className="bg-slate-900 px-1 py-0.5 rounded">
                JavascriptInterface
              </code>{" "}
              named{" "}
              <code className="bg-slate-900 px-1 py-0.5 rounded">Android</code>{" "}
              on the WebView with methods for{" "}
              <code className="text-blue-300">
                requestPermission(String name)
              </code>{" "}
              and{" "}
              <code className="text-blue-300">hasPermission(String name)</code>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Download size={18} className="text-blue-400" /> Convert to Mobile App (APK)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              You don't need to write code to make this an app! Aura is a <strong>Progressive Web App (PWA)</strong>.
            </p>
            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
              <li>Open this page in <strong>Chrome</strong> on your Android phone.</li>
              <li>Tap the <strong>three dots</strong> (menu) in the top right.</li>
              <li>Select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.</li>
              <li>Aura will now appear in your app drawer as a <strong>Standalone Assistant App</strong>.</li>
            </ol>
            <div className="pt-2 text-[10px] text-blue-400/70 italic">
              * This provides an APK-like experience with full screen toggle and persistence.
            </div>
          </div>
        </section>

        {/* Manage Contacts Section */}
        <section className="space-y-4">
          <div className="text-xl font-medium text-emerald-400 border-b border-slate-700 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users size={20} /> Manage Contacts
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    // 1. Check for Secure Context (Required for Contacts API)
                    if (!window.isSecureContext) {
                      alert(
                        "The Contact Picker API is only available in secure contexts (HTTPS). Please ensure you are viewing the live version of the app.",
                      );
                      return;
                    }

                    // 2. Check for Iframe (Standard restriction)
                    let inIframe = false;
                    try {
                      inIframe = window.self !== window.top;
                    } catch (e) {
                      inIframe = true;
                    }
                    if (inIframe) {
                      alert(
                        "Security Restricted: Browsers block contact access inside preview windows. Please open this app in a new tab using the button at the top-right to use the Import feature.",
                      );
                      return;
                    }

                    const nav = navigator as any;
                    if (
                      nav.contacts &&
                      typeof nav.contacts.select === "function"
                    ) {
                      const props = ["name", "tel"];
                      const opts = { multiple: true };

                      const results = await nav.contacts.select(props, opts);
                      if (
                        results &&
                        Array.isArray(results) &&
                        results.length > 0
                      ) {
                        const imported = results
                          .map((c: any) => ({
                            id: crypto.randomUUID(),
                            name:
                              (Array.isArray(c.name) ? c.name[0] : c.name) ||
                              "Unknown",
                            number:
                              (Array.isArray(c.tel) ? c.tel[0] : c.tel) || "",
                          }))
                          .filter((c) => c.name !== "Unknown" && c.number);

                        if (imported.length > 0) {
                          setFormData((prev) => ({
                            ...prev,
                            contacts: [...(prev.contacts || []), ...imported],
                          }));
                          alert(
                            `Imported ${imported.length} contacts successfully.`,
                          );
                        }
                      }
                    } else {
                      alert(
                        "Your browser doesn't support the Contact Picker API yet. Please try using a mobile browser like Chrome on Android or Safari on iOS.",
                      );
                    }
                  } catch (err: any) {
                    console.warn("Contact Import failed:", err);

                    if (err.name === "SecurityError") {
                      alert(
                        "Access Denied: Your browser blocked the contact picker for security reasons (likely due to running inside a frame or cross-origin window). Please open the app in a new tab.",
                      );
                    } else if (err.name === "AbortError") {
                      // Silent fail as requested for cancel
                      console.info("User cancelled the contact picker.");
                    } else if (err.name === "NotAllowedError") {
                      alert(
                        "Permission Denied: You must grant permission to access your contacts to use this feature.",
                      );
                    } else {
                      alert(
                        `Unable to import: ${err.message || "An unexpected error occurred. Please ensure your device is compatible."}`,
                      );
                    }
                  }
                }}
                className="flex items-center gap-1 text-sm bg-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-600 transition-colors"
                title="Import contacts from your phone's address book"
              >
                <Download size={16} /> Import
              </button>
              <button
                type="button"
                onClick={handleAddContact}
                className="flex items-center gap-1 text-sm bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus size={16} /> Add Contact
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
            {(formData.contacts || []).map((contact) => (
              <div
                key={contact.id}
                className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between group h-[84px]"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex-shrink-0 flex items-center justify-center text-emerald-400">
                    <Users size={18} />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-medium text-slate-100 truncate">
                      {contact.name}
                    </h4>
                    <p className="text-sm text-slate-400 font-mono truncate">
                      {contact.number}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingContact(contact)}
                    className="p-2 hover:bg-slate-700 rounded-lg text-blue-400"
                    aria-label={`Edit ${contact.name}`}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteContact(contact.id)}
                    className="p-2 hover:bg-slate-700/50 rounded-lg text-red-500/80 hover:text-red-500"
                    aria-label={`Delete ${contact.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {(!formData.contacts || formData.contacts.length === 0) && (
              <div className="col-span-full py-8 text-center bg-slate-800/30 border border-dashed border-slate-700 rounded-xl text-slate-500">
                No contacts found. Add some for quick dials!
              </div>
            )}
          </div>

          {editingContact && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                  <h4 className="text-xl font-semibold flex items-center gap-2">
                    {editingContact.id ? (
                      <Edit2 size={20} />
                    ) : (
                      <Plus size={20} />
                    )}
                    {editingContact.id ? "Edit Contact" : "New Contact"}
                  </h4>
                  <button
                    onClick={() => setEditingContact(null)}
                    className="p-1 hover:bg-slate-700 rounded-full"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Grandma, Office"
                      value={editingContact.name || ""}
                      onChange={(e) =>
                        setEditingContact({
                          ...editingContact,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      placeholder="+1 234 567 890"
                      value={editingContact.number || ""}
                      onChange={(e) =>
                        setEditingContact({
                          ...editingContact,
                          number: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveContact();
                      }}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => setEditingContact(null)}
                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 font-medium rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveContact}
                    disabled={!editingContact.name || !editingContact.number}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl disabled:opacity-50"
                  >
                    Save Contact
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Cloud AI Providers Table */}
        <section className="space-y-4">
          <h3 className="text-xl font-medium text-blue-400 border-b border-slate-700 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield size={20} /> AI Providers
            </span>
            <button
              type="button"
              onClick={handleAddProvider}
              className="flex items-center gap-1 text-sm bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} /> Add Provider
            </button>
          </h3>

          <div className="overflow-x-auto bg-slate-800 rounded-xl border border-slate-700">
            <table className="w-full text-left">
              <thead className="text-sm text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-4 font-medium">Active</th>
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Base URL</th>
                  <th className="p-4 font-medium">Model</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                <tr
                  className={
                    formData.selectedProviderId === "default"
                      ? "bg-blue-500/10"
                      : ""
                  }
                >
                  <td className="p-4">
                    <input
                      type="radio"
                      name="selectedProvider"
                      className="w-5 h-5"
                      checked={formData.selectedProviderId === "default"}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          selectedProviderId: "default",
                        })
                      }
                    />
                  </td>
                  <td className="p-4 font-medium">Default (Gemini)</td>
                  <td className="p-4 text-sm text-slate-400">
                    Google Cloud (Built-in)
                  </td>
                  <td className="p-4 text-sm text-slate-400">
                    gemini-3-flash-preview
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                      System
                    </span>
                  </td>
                </tr>
                {(formData.customProviders || []).map((provider) => (
                  <tr
                    key={provider.id}
                    className={
                      formData.selectedProviderId === provider.id
                        ? "bg-blue-500/10"
                        : ""
                    }
                  >
                    <td className="p-4">
                      <input
                        type="radio"
                        name="selectedProvider"
                        className="w-5 h-5"
                        checked={formData.selectedProviderId === provider.id}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            selectedProviderId: provider.id,
                          })
                        }
                      />
                    </td>
                    <td className="p-4 font-medium truncate max-w-[120px]">
                      {provider.name}
                    </td>
                    <td className="p-4 text-sm text-slate-400 truncate max-w-[200px]">
                      {provider.baseUrl}
                    </td>
                    <td className="p-4 text-sm text-slate-400">
                      {provider.modelName || "default"}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingProvider(provider);
                          setAvailableModels([]);
                          setModelFetchError("");
                          setModelFetchSuccess("");
                        }}
                        className="p-2 hover:bg-slate-700 rounded-lg text-blue-400"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteProvider(provider.id)}
                        className="p-2 hover:bg-slate-700 rounded-lg text-red-400"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingProvider && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                  <h4 className="text-xl font-semibold">
                    {editingProvider.id ? "Edit Provider" : "Add New Provider"}
                  </h4>
                  <button
                    onClick={() => setEditingProvider(null)}
                    className="p-1 hover:bg-slate-700 rounded-full"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  {!editingProvider.id && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Quick Setup Presets</label>
                      <div className="flex flex-wrap gap-2">
                        {presetProviders.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => setEditingProvider((prev) => ({ ...prev, name: preset.name, baseUrl: preset.baseUrl }))}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Groq, Local Ollama"
                      value={editingProvider.name || ""}
                      onChange={(e) =>
                        setEditingProvider({
                          ...editingProvider,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Base URL
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://api.groq.com/openai/v1"
                      value={editingProvider.baseUrl || ""}
                      onChange={(e) =>
                        setEditingProvider({
                          ...editingProvider,
                          baseUrl: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      API Key
                    </label>
                    <input
                      type="password"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="gsk_..."
                      value={editingProvider.apiKey || ""}
                      onChange={(e) =>
                        setEditingProvider({
                          ...editingProvider,
                          apiKey: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium mb-0">
                        Model Name
                      </label>
                      <button
                        onClick={fetchModelsList}
                        disabled={isFetchingModels || !editingProvider.baseUrl || !editingProvider.apiKey}
                        className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded disabled:opacity-50 transition-colors"
                      >
                        {isFetchingModels ? "Fetching..." : "Fetch Models"}
                      </button>
                    </div>

                    {availableModels.length > 0 ? (
                      <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                        value={editingProvider.modelName || ""}
                        onChange={(e) =>
                          setEditingProvider({
                            ...editingProvider,
                            modelName: e.target.value,
                          })
                        }
                      >
                        <option value="" disabled>Select a model...</option>
                        {availableModels.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="llama3-8b-8192"
                        value={editingProvider.modelName || ""}
                        onChange={(e) =>
                          setEditingProvider({
                            ...editingProvider,
                            modelName: e.target.value,
                          })
                        }
                      />
                    )}
                    {modelFetchError && <p className="text-red-400 text-xs mt-1">{modelFetchError}</p>}
                    {modelFetchSuccess && <p className="text-green-400 text-xs mt-1">{modelFetchSuccess}</p>}
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => setEditingProvider(null)}
                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 font-medium rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProvider}
                    disabled={!editingProvider.name || !editingProvider.baseUrl}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl disabled:opacity-50"
                  >
                    Save Provider
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* TTS Engine */}
        <section className="space-y-4 pb-24">
          <h3 className="text-xl font-medium text-blue-400 border-b border-slate-700 pb-2 flex items-center gap-2">
            <Volume2 size={20} /> High-Quality Voice & Cloning (TTS)
          </h3>
          <p className="text-slate-400">
            Configure Coqui, Moss, or Browser-native engines for real human-like
            speech. Note: Coqui/Moss require a valid Base URL endpoint.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="ttsProvider"
                className="block text-lg font-medium"
              >
                TTS Engine Provider
              </label>
              <select
                id="ttsProvider"
                className="w-full p-4 bg-slate-800 border border-slate-600 rounded-xl text-lg focus:ring-4 focus:ring-blue-500 outline-none"
                value={formData.ttsEngine.provider}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ttsEngine: {
                      ...formData.ttsEngine,
                      provider: e.target.value as any,
                    },
                  })
                }
              >
                <option value="browser">Browser Native (Standard)</option>
                <option value="coqui">Coqui TTS (Custom Endpoint)</option>
                <option value="moss">Moss Voice (Custom Endpoint)</option>
                <option value="custom">Custom API (Cloud/Local)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="voiceGender"
                className="block text-lg font-medium"
              >
                Voice Gender Target
              </label>
              <select
                id="voiceGender"
                className="w-full p-4 bg-slate-800 border border-slate-600 rounded-xl text-lg focus:ring-4 focus:ring-blue-500 outline-none"
                value={formData.ttsEngine.voiceGender || "female"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ttsEngine: {
                      ...formData.ttsEngine,
                      voiceGender: e.target.value as any,
                    },
                  })
                }
              >
                <option value="female">Natural Female</option>
                <option value="male">Natural Male</option>
                <option value="custom">Cloned / Custom Sample</option>
              </select>
            </div>
          </div>

          {formData.ttsEngine.provider !== "browser" && (
            <div className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700 mt-4">
              <div>
                <label
                  htmlFor="ttsBaseUrl"
                  className="block text-lg mb-2 font-medium"
                >
                  Base URL / API Endpoint
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Required for {formData.ttsEngine.provider}. Use
                  "http://localhost:5002" if running locally on your device.
                </p>
                <input
                  type="url"
                  id="ttsBaseUrl"
                  placeholder={
                    formData.ttsEngine.provider === "coqui"
                      ? "e.g. http://localhost:5002"
                      : "e.g. https://your-api.com/v1"
                  }
                  className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-lg focus:ring-4 focus:ring-blue-500 outline-none"
                  value={formData.ttsEngine.baseUrl || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ttsEngine: {
                        ...formData.ttsEngine,
                        baseUrl: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="ttsApiKey"
                  className="block text-lg mb-2 font-medium"
                >
                  API Key (Optional)
                </label>
                <input
                  type="password"
                  id="ttsApiKey"
                  placeholder="Bearer token"
                  className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-lg focus:ring-4 focus:ring-blue-500 outline-none"
                  value={formData.ttsEngine.apiKey || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ttsEngine: {
                        ...formData.ttsEngine,
                        apiKey: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="ttsVoiceId"
                  className="block text-lg mb-2 font-medium"
                >
                  Model / Voice ID
                </label>
                <input
                  type="text"
                  id="ttsVoiceId"
                  placeholder={
                    formData.ttsEngine.provider === "coqui"
                      ? "e.g. tts_models/multilingual/multi-dataset/xtts_v2"
                      : "e.g. alloy, nova"
                  }
                  className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-lg focus:ring-4 focus:ring-blue-500 outline-none"
                  value={formData.ttsEngine.voiceId || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ttsEngine: {
                        ...formData.ttsEngine,
                        voiceId: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div className="pt-4 border-t border-slate-700/50">
                <label className="block font-medium mb-3 flex items-center justify-between">
                  <span>Voice Cloning (10s Sample)</span>
                  {isRecording && (
                    <span className="text-red-400 animate-pulse font-mono">
                      {10 - recordingSeconds}s remaining
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all relative overflow-hidden ${isRecording ? "bg-red-500 text-white ring-4 ring-red-500/20" : "bg-slate-700 text-slate-100 hover:bg-slate-600"}`}
                  >
                    {isRecording && (
                      <div
                        className="absolute left-0 bottom-0 top-0 bg-white/20 transition-all duration-1000"
                        style={{ width: `${(recordingSeconds / 10) * 100}%` }}
                      />
                    )}
                    <Mic
                      size={20}
                      className={isRecording ? "animate-bounce" : ""}
                    />
                    {isRecording ? "Stop Recording" : "Clone My Voice"}
                  </button>
                  <input
                    type="file"
                    id="ttsCloneAudio"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setFormData({
                            ...formData,
                            ttsEngine: {
                              ...formData.ttsEngine,
                              cloneAudioBase64: ev.target?.result as string,
                            },
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="ttsCloneAudio"
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl font-bold cursor-pointer border border-slate-600"
                  >
                    Upload WAV
                  </label>
                </div>

                {formData.ttsEngine.cloneAudioBase64 && (
                  <div className="mt-3 flex justify-between items-center text-sm bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                    <div className="flex flex-col">
                      <span className="text-emerald-400 font-bold tracking-wide flex items-center gap-2 text-base">
                        <Check size={20} /> Voice Model Ready
                      </span>
                      <p className="text-slate-400 mt-1">
                        Speaker profile successfully captured for zero-shot
                        cloning.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          ttsEngine: {
                            ...formData.ttsEngine,
                            cloneAudioBase64: undefined,
                          },
                        })
                      }
                      className="text-red-400 hover:text-white transition-colors ml-4 font-bold px-4 py-2 bg-red-400/10 hover:bg-red-500 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-4 leading-relaxed font-light">
                  Aura uses on-device neural synthesis logic when enabled.
                  Zero-shot cloning requires a high-quality 10-second reference
                  audio. Ensure you are in a quiet environment for best results.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-4 shrink-0">
        <button
          onClick={handleSubmit}
          className="w-full p-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xl flex items-center justify-center gap-2 focus:ring-4 focus:ring-blue-400 outline-none shadow-lg"
          aria-label="Save Settings"
        >
          <Save size={24} /> Save Configuration
        </button>
      </div>
    </div>
  );
}
