export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface ApiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
}

export interface AssistantSettings {
  language: 'en-US' | 'hi-IN';
  voiceId?: string; // URI or matching name for speechSynthesis
  wakeWordEnabled: boolean;
  wakeWord: string;
  webSearchEnabled: boolean; // For default Gemini engine
  selectedProviderId: 'default' | string;
  customProviders: ApiProvider[];
  cloudEngine: {
    // Keep for backwards compatibility during migration if needed, but we'll prefer selectedProviderId
    provider: 'default' | 'custom';
    apiKey?: string;
    baseUrl?: string;
    modelName?: string;
  };
  ttsEngine: {
    provider: 'browser' | 'coqui' | 'moss' | 'custom';
    baseUrl?: string;
    apiKey?: string;
    voiceId?: string; // model / voice specifier string
    voiceGender?: 'male' | 'female' | 'custom';
    cloneAudioBase64?: string; // For Coqui/Moss zero-shot speaker wavs
  };
  contacts: Contact[];
  contactList: Record<string, string>; // name -> number mapped, Native Android contacts (Legacy)
  advancedIntegrations: boolean; // Enables deep-link system commands and auto-execution
  androidMode: boolean; // Tells the system to use Android Intents instead of web fallback
  hardwareTriggerEnabled: boolean; // Enables double-shake trigger
  powerButtonTriggerEnabled: boolean; // Enables power button trigger
  permissions: Record<string, boolean>; // System permissions state
}

export const defaultSettings: AssistantSettings = {
  language: 'en-US',
  wakeWordEnabled: false,
  wakeWord: 'aura',
  webSearchEnabled: true,
  selectedProviderId: 'default',
  customProviders: [],
  cloudEngine: {
    provider: 'default',
  },
  ttsEngine: {
    provider: 'browser',
  },
  contacts: [
    { id: '1', name: 'Mom', number: '555-0100' },
    { id: '2', name: 'Dad', number: '555-0101' },
    { id: '3', name: 'Emergency', number: '911' },
  ],
  contactList: {}, // Kept for safety during migration
  advancedIntegrations: true,
  androidMode: true,
  hardwareTriggerEnabled: true,
  powerButtonTriggerEnabled: true,
  permissions: {
    contacts: false,
    call: false,
    sms: false,
    apps: false,
    accessibility: false,
    audio: false,
    camera: false,
    location: false,
    storage: false,
    overlay: false,
  }
};
