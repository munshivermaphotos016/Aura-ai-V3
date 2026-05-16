import React, { useState, useRef, useEffect } from "react";
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
  AlertCircle,
} from "lucide-react";
import { AssistantSettings, ApiProvider, Contact } from "../types";
import { requestNativePermission, isNativeAndroid, checkNativePermission } from "../lib/nativeBridge";
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

  useEffect(() => {
    if (isNativeAndroid()) {
      const currentPerms = { ...formData.permissions } as Record<string, boolean>;
      const allPerms = ["audio", "camera", "location", "storage", "contacts", "call", "sms", "apps", "accessibility", "overlay"];
      
      let updated = false;
      allPerms.forEach(perm => {
        const isGranted = checkNativePermission(perm);
        if (currentPerms[perm] !== isGranted) {
          currentPerms[perm] = isGranted;
          updated = true;
        }
      });
      
      if (updated) {
        setFormData(prev => ({
          ...prev,
          permissions: {
            ...prev.permissions,
            ...currentPerms
          }
        }));
      }
    }
  }, []);

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
      let url = editingProvider.baseUrl?.trim();
      if (!url) {
        throw new Error("Base URL cannot be empty. Please enter a valid URL.");
      }
      if (!url.startsWith("http")) {
        url = "https://" + url;
      }
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
    <div className="absolute inset-0 bg-transparent z-50 flex flex-col overflow-y-auto w-full max-w-full">
      <header className="flex justify-between items-center p-4 border-b border-white/10 aura-glass sticky top-0 z-10 m-2 rounded-2xl">
        <h2 className="text-2xl font-semibold text-white tracking-wide neon-text">System Settings</h2>
        <button
          onClick={onClose}
          className="p-3 bg-white/5 text-blue-200 rounded-full hover:bg-white/10 focus:ring-2 focus:ring-[#00f0ff] outline-none"
          aria-label="Close Settings"
        >
          <X size={24} />
        </button>
      </header>

      <div className="p-6 space-y-10 text-blue-100/90 pb-32">
        {/* General Settings */}
        <section className="space-y-4 aura-glass p-6 rounded-3xl">
          <h3 className="text-xl font-medium text-[#00f0ff] pb-2 border-b border-white/10">
            General Options
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
              className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-lg focus:ring-2 focus:ring-[#00f0ff] outline-none"
              value={formData.language}
              onChange={(e) =>
                setFormData({ ...formData, language: e.target.value as any })
              }
            >
              <option value="en-US" className="bg-slate-900">English (US)</option>
              <option value="en-IN" className="bg-slate-900">English (India)</option>
              <option value="hi-IN" className="bg-slate-900">Hindi / Hinglish</option>
            </select>
          </div>

          <div>
            <label htmlFor="voice" className="block text-lg mb-2 font-medium">
              Assistant Voice
            </label>
            <div className="flex gap-2">
              <select
                id="voice"
                className="flex-1 p-4 bg-white/10 border border-white/10 rounded-xl text-lg focus:ring-2 focus:ring-[#00f0ff] outline-none"
                value={formData.voiceId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, voiceId: e.target.value })
                }
              >
                <option value="" className="bg-slate-900">Auto-Detect via Output Language</option>
                {voices.map((v, i) => (
                  <option
                    key={`${v.voiceURI}-${v.name}-${i}`}
                    value={v.voiceURI}
                    className="bg-slate-900"
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
                className="p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[#00f0ff] focus:ring-2 focus:ring-[#00f0ff] outline-none transition-colors"
                title="Test Voice"
              >
                <Volume2 size={24} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <input
              type="checkbox"
              id="webSearchEnabled"
              className="w-8 h-8 rounded text-[#00f0ff] focus:ring-[#00f0ff] bg-white/10 border-white/10 cursor-pointer"
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
                Enable Web Search Grounding (May Censor Content)
              </label>
              <p className="text-sm text-slate-400">
                Allows the default Gemini model to search the live web. Warning: Google Search has built-in safety filters that may refuse explicit or NSFW prompts if this is enabled. Turning this off ensures fully uncensored generation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <input
              type="checkbox"
              id="wakeWordEnabled"
              className="w-8 h-8 rounded text-[#00f0ff] focus:ring-[#00f0ff] bg-white/10 border-white/10"
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

          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <input
              type="checkbox"
              id="hardwareTriggerEnabled"
              className="w-8 h-8 rounded text-[#00f0ff] focus:ring-[#00f0ff] bg-white/10 border-white/10 cursor-pointer"
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

          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <input
              type="checkbox"
              id="powerButtonTriggerEnabled"
              className="w-8 h-8 rounded text-[#00f0ff] focus:ring-[#00f0ff] bg-white/10 border-white/10 cursor-pointer"
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

          <div className="p-4 rounded-xl border border-white/10 bg-white/10 border border-white/10 hover:border-white/20/5 space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                id="advancedIntegrations"
                className="w-8 h-8 rounded text-[#00f0ff] focus:ring-[#00f0ff] bg-white/10 border-white/10 cursor-pointer"
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
                  <Shield size={20} className="text-[#00f0ff]" /> Advanced
                  System Permissions
                </label>
                <p className="text-sm text-blue-200 mt-1">
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
                className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-lg focus:ring-2 focus:ring-[#00f0ff] outline-none"
                value={formData.wakeWord}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    wakeWord: e.target.value.toLowerCase(),
                  })
                }
              />
              <p className="text-sm mt-2 text-slate-400">
                Note: Web browsers must keep the microphone active to detect background voice. A media lock is used to suppress continuous system beeps, resembling an OS-level silent listener as much as technically possible on the web.
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <input
              type="checkbox"
              id="subtitlesEnabled"
              className="w-8 h-8 rounded text-[#00f0ff] focus:ring-[#00f0ff] bg-white/10 border-white/10 cursor-pointer"
              checked={formData.subtitlesEnabled !== false}
              onChange={(e) =>
                setFormData({ ...formData, subtitlesEnabled: e.target.checked })
              }
            />
            <div className="flex-1">
              <label
                htmlFor="subtitlesEnabled"
                className="text-lg font-medium block text-slate-100"
              >
                Show Overlay Subtitles
              </label>
              <p className="text-sm text-blue-200">
                Display live captions when using the assistant overlay mode.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <input
              type="checkbox"
              id="micSoundEnabled"
              className="w-8 h-8 rounded text-[#00f0ff] focus:ring-[#00f0ff] bg-white/10 border-white/10 cursor-pointer"
              checked={formData.micSoundEnabled === true}
              onChange={(e) =>
                setFormData({ ...formData, micSoundEnabled: e.target.checked })
              }
            />
            <div className="flex-1">
              <label
                htmlFor="micSoundEnabled"
                className="text-lg font-medium block text-slate-100"
              >
                Mic Sound Effects
              </label>
              <p className="text-sm text-blue-200">
                Play a beep sound when the mic turns on or off. Vibrate is always on.
              </p>
            </div>
          </div>
        </section>

        {/* Android Native Mode & Permissions */}
        <section className="space-y-4 aura-glass p-6 rounded-3xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-medium text-[#8a2be2] flex items-center gap-2 pb-2 border-b border-white/10 w-full">
              <Shield size={20} /> System Permissions
            </h3>
            <button
              type="button"
              onClick={async () => {
                const perms = ["audio", "camera", "location", "storage", "contacts", "call", "sms", "apps", "accessibility", "overlay"];
                const newPerms = { ...formData.permissions };
                for (const p of perms) {
                  if (!newPerms[p]) {
                    newPerms[p] = await requestNativePermission(p);
                  }
                }
                setFormData({ ...formData, permissions: newPerms });
              }}
              className="px-3 py-1.5 bg-white/10 border border-white/10 hover:bg-white/20 text-[#8a2be2] text-sm font-medium rounded-lg transition-colors border-white/10"
            >
              Request All Permissions
            </button>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                id="androidMode"
                className="w-8 h-8 rounded text-[#8a2be2] focus:ring-[#8a2be2] bg-white/10 border-white/10 cursor-pointer"
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
                <p className="text-sm text-blue-200 mt-1">
                  If enabled, opening apps will attempt to use native Android
                  app deep links (e.g. intent://) instead of rendering them in
                  the web view.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                id="deepLinkingEnabled"
                className="w-8 h-8 rounded text-[#8a2be2] focus:ring-[#8a2be2] bg-white/10 border-white/10 cursor-pointer"
                checked={formData.deepLinkingEnabled !== false}
                onChange={(e) =>
                  setFormData({ ...formData, deepLinkingEnabled: e.target.checked })
                }
              />
              <div className="flex-1">
                <label
                  htmlFor="deepLinkingEnabled"
                  className="text-lg font-medium flex items-center gap-2"
                >
                  Native App Deep-Linking
                </label>
                <p className="text-sm text-blue-200 mt-1">
                  Leverage `Android.openIntent()` to open specific apps directly using intents, behaving precisely like a native OS assistant.
                </p>
              </div>
            </div>

            {formData.deepLinkingEnabled !== false && (
              <div className="pl-12 pt-2 space-y-4 border-t border-white/10 mt-2">
                <h4 className="text-md font-medium text-blue-200">App Intent Handling</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(
                    formData.appIntentHandling || {
                      whatsapp: 'com.whatsapp',
                      youtube: 'com.google.android.youtube',
                      netflix: 'com.netflix.mediaclient',
                    }
                  ).map(([app, pkg]) => (
                    <div key={app} className="flex flex-col gap-1">
                      <label className="text-sm text-slate-300 capitalize">{app} Package</label>
                      <input
                        type="text"
                        value={pkg}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            appIntentHandling: {
                              ...formData.appIntentHandling,
                              [app]: e.target.value,
                            }
                          })
                        }}
                        className="bg-white/10 border border-white/10 p-2 rounded text-sm text-white focus:ring-1 focus:ring-[#8a2be2] outline-none w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(
              formData.permissions || {
                audio: false,     camera: false,
                contacts: false,  location: false,
                call: false,      storage: false,
                sms: false,       overlay: false,
                apps: false,      accessibility: false,
              },
            ).map(([perm, val]) => (
              <div
                key={perm}
                className="flex items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10"
              >
                <div className="flex-1">
                  <div className="capitalize font-medium text-slate-100 flex items-center gap-2">
                    {perm} {val ? <Check size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-slate-500" />}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {val ? 'Granted' : 'Not Granted'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    let allowed = val;
                    // Only request permission if trying to turn it ON, otherwise just trigger setting false. Native doesn't allow turning off programmatically in standard ways usually.
                    if (!val) {
                      allowed = await requestNativePermission(perm);
                    } else {
                        // User trying to revoke
                        if (isNativeAndroid()) {
                            alert("To revoke permissions, please open Android System Settings > Apps > Aura > Permissions.");
                            // If they clicked to revoke, it will try to check again if revoked
                            const current = checkNativePermission(perm);
                            allowed = current; 
                        } else {
                            allowed = false;
                        }
                    }

                    if (allowed !== val) {
                      setFormData({
                        ...formData,
                        permissions: {
                          ...(formData.permissions || {}),
                          [perm]: allowed,
                        },
                      });
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    val 
                      ? "bg-white/5 text-slate-400 hover:text-white" 
                      : "bg-[#8a2be2]/20 text-[#d4b3ff] hover:bg-[#8a2be2]/40"
                  }`}
                >
                  {val ? "Manage" : "Request"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Manage Contacts Section */}
        <section className="space-y-4 aura-glass p-6 rounded-3xl">
          <div className="text-xl font-medium text-emerald-400 border-b border-white/10 pb-2 flex items-center justify-between">
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
                className="flex items-center gap-1 text-sm bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors border border-white/10"
                title="Import contacts from your phone's address book"
              >
                <Download size={16} /> Import
              </button>
              <button
                type="button"
                onClick={handleAddContact}
                className="flex items-center gap-1 text-sm bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-500/20/80 transition-colors"
              >
                <Plus size={16} /> Add Contact
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
            {(formData.contacts || []).map((contact) => (
              <div
                key={contact.id}
                className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between group h-[84px] hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-500/20/20 flex-shrink-0 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
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
              <div className="col-span-full py-8 text-center bg-white/5 border border-dashed border-white/20 rounded-xl text-blue-200/50">
                No contacts found. Add some for quick dials!
              </div>
            )}
          </div>

          {editingContact && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-3xl backdrop-blur-xl z-[70] flex items-center justify-center p-4">
              <div className="aura-glass w-full max-w-sm rounded-3xl shadow-[0_0_40px_rgba(16,185,129,0.1)] p-6 space-y-6 border border-white/10">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#10b981]"
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
                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 border border-white/10 font-medium rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveContact}
                    disabled={!editingContact.name || !editingContact.number}
                    className="flex-1 py-3 bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-500/20/80 font-bold rounded-xl disabled:opacity-50 text-white"
                  >
                    Save Contact
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Cloud AI Providers Table */}
        <section className="space-y-4 aura-glass p-6 rounded-3xl">
          <h3 className="text-xl font-medium text-[#00f0ff] border-b border-white/10 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield size={20} /> AI Providers
            </span>
            <button
              type="button"
              onClick={handleAddProvider}
              className="flex items-center gap-1 text-sm bg-white/10 border border-white/10 hover:border-white/20 text-black px-3 py-1.5 rounded-lg hover:bg-white/10 border border-white/10 hover:border-white/20/80 font-bold"
            >
              <Plus size={16} /> Add Provider
            </button>
          </h3>

          <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
            <table className="w-full text-left">
              <thead className="text-sm text-blue-200/70 border-b border-white/10">
                <tr>
                  <th className="p-4 font-medium">Active</th>
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Base URL</th>
                  <th className="p-4 font-medium">Model</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr
                  className={
                    formData.selectedProviderId === "default"
                      ? "bg-white/10 border border-white/10 hover:border-white/20/10"
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
                  <td className="p-4 text-sm text-blue-200/80">
                    Google Cloud (Built-in)
                  </td>
                  <td className="p-4 text-sm text-blue-200/80">
                    gemini-3-flash-preview
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-slate-300">
                      System
                    </span>
                  </td>
                </tr>
                {(formData.customProviders || []).map((provider) => (
                  <tr
                    key={provider.id}
                    className={
                      formData.selectedProviderId === provider.id
                        ? "bg-white/10 border border-white/10 hover:border-white/20/10"
                        : "hover:bg-white/5"
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
                className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-lg focus:ring-2 focus:ring-[#00f0ff] outline-none"
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
                <option value="female" className="bg-slate-900">Natural Female</option>
                <option value="male" className="bg-slate-900">Natural Male</option>
                <option value="custom" className="bg-slate-900">Cloned / Custom Sample</option>
              </select>
            </div>
          </div>

          {formData.ttsEngine.provider !== "browser" && (
            <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10 mt-4">
              {formData.ttsEngine.provider === "coqui" && (
                <div className="bg-[#8a2be2]/10 border border-[#8a2be2]/30 p-4 rounded-xl text-sm text-[#d4b3ff]">
                  <h4 className="font-bold text-white mb-1">Coqui TTS XTTS_v2 Implementation</h4>
                  <p>To run Coqui locally, start the official Docker container. Ensure CORS is enabled. The default port is 5002.</p>
                  <code className="block bg-black/30 p-2 rounded mt-2 font-mono text-xs text-[#00f0ff]">
                    docker run --rm -p 5002:5002 -e MODEL_NAME=tts_models/multilingual/multi-dataset/xtts_v2 ghcr.io/coqui-ai/tts-server
                  </code>
                </div>
              )}
              {formData.ttsEngine.provider === "moss" && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-sm text-emerald-200">
                  <h4 className="font-bold text-white mb-1">Moss Voice Implementation</h4>
                  <p>Moss is a fast, lightweight TTS model. Deploy the Moss inference endpoint. It expects a similar payload to standard TTS APIs, but with internal Moss IDs.</p>
                  <p className="mt-2">Use <code className="text-white">http://localhost:8080/api/tts</code> if running locally natively.</p>
                </div>
              )}
              {formData.ttsEngine.provider === "custom" && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-sm text-amber-200">
                  <h4 className="font-bold text-white mb-1">Custom TTS Cloud/Local API</h4>
                  <p>The endpoint must accept a JSON payload with <code className="text-white">{"{ text: string }"}</code> and return an audio stream (e.g., audio/mpeg or audio/wav). Perfect for Piper TTS, OpenAI TTS, or custom endpoints.</p>
                </div>
              )}

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
                  list="voiceModelsList"
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
                <datalist id="voiceModelsList">
                  {formData.ttsEngine.provider === 'coqui' && (
                    <option value="tts_models/multilingual/multi-dataset/xtts_v2" />
                  )}
                  {formData.ttsEngine.provider === 'moss' && (
                    <option value="moss_v1_base" />
                  )}
                  {formData.ttsEngine.provider === 'custom' && (
                    <>
                      <option value="alloy" />
                      <option value="echo" />
                      <option value="fable" />
                      <option value="onyx" />
                      <option value="nova" />
                      <option value="shimmer" />
                    </>
                  )}
                </datalist>
              </div>

              <div className="pt-4 border-t border-white/10">
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
                    className={`px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all relative overflow-hidden ${isRecording ? "bg-red-500 text-white ring-4 ring-red-500/20" : "bg-white/10 text-white hover:bg-white/20 border border-white/10"}`}
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
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold cursor-pointer border border-white/10"
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

      <div className="sticky bottom-0 aura-glass p-4 shrink-0 rounded-t-3xl border-t border-white/10">
        <button
          onClick={handleSubmit}
          className="w-full p-5 bg-white/10 border border-white/10 hover:border-white/20 hover:bg-white/10 border border-white/10 hover:border-white/20/80 text-white font-bold rounded-2xl text-xl flex items-center justify-center gap-2 shadow-lg"
          aria-label="Save Settings"
        >
          <Save size={24} /> Save Configuration
        </button>
      </div>
    </div>
  );
}
