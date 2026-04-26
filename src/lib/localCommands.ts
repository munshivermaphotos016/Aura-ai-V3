import { AssistantSettings, Message } from '../types';

export interface LocalAction {
  type: 'call' | 'message' | 'open' | 'time' | 'date' | 'confirm' | 'cancel' | 'system' | 'task' | 'unknown';
  payload?: any;
  response: string;
  confidence: number;
  searchPhone?: boolean;
}

/**
 * Task Definition for Multi-step sequences
 */
export interface TaskStep {
  action: string;
  payload: any;
  description: string;
}

/**
 * Helper to extract intent for complex tasks (Uncensored & Direct)
 */
function extractTask(text: string): { steps: TaskStep[], response: string } | null {
  // Pattern: Play [thing] on [app]
  const playMatch = text.match(/play\s+(.+?)\s+on\s+(.+)/i) || 
                   text.match(/watch\s+(.+?)\s+on\s+(.+)/i) ||
                   text.match(/(.+?)\s+chalao\s+on\s+(.+)/i) ||  // Hinglish: "Song chalao on youtube"
                   text.match(/(.+?)\s+lagao\s+on\s+(.+)/i);    // Hinglish: "Game lagao on playstore"
  if (playMatch) {
    const item = playMatch[1].trim();
    const app = playMatch[2].trim();
    return {
      steps: [
        { action: 'open_app', payload: { app, query: item }, description: `Opening ${app} to play ${item}` }
      ],
      response: `Sure, buddy. Opening ${app} so you can watch ${item}.`
    };
  }

  // Pattern: Search for [thing] on [app/site]
  const appSearchMatch = text.match(/search\s+(?:for\s+)?(.+?)\s+on\s+(.+)/i) ||
                        text.match(/(.+?)\s+dhoondho\s+on\s+(.+)/i); // Hinglish: "Pizza dhoondho on maps"
  if (appSearchMatch) {
    const query = appSearchMatch[1].trim();
    const app = appSearchMatch[2].trim();
    return {
      steps: [
        { action: 'open_app', payload: { app, query }, description: `Searching ${app} for ${query}` }
      ],
      response: `Searching for ${query} on ${app} right now.`
    };
  }

  // Pattern: Open browser and search [thing]
  const browserSearchMatch = text.match(/search\s+(.+?)\s+on\s+browser/i) || 
                             text.match(/search\s+(.+?)\s+on\s+google/i) || 
                             text.match(/search\s+(.+?)(?:\s+on\s+the\s+web|\s+online)/i) ||
                             text.match(/google\s+(.+)/i);
  if (browserSearchMatch) {
    const query = browserSearchMatch[1].trim();
    return {
      steps: [
        { action: 'open_app', payload: { app: 'google', query }, description: `Searching for ${query}` }
      ],
      response: `I'll search for ${query} for you right away.`
    };
  }

  // Pattern: Download [thing] from [store]
  const downloadMatch = text.match(/download\s+(.+?)\s+from\s+(.+)/i) || 
                       text.match(/get\s+(.+?)\s+(?:from|on)\s+(.+?store)/i) ||
                       text.match(/download\s+(.+)/i);
  if (downloadMatch) {
    const item = downloadMatch[1].trim();
    const store = downloadMatch[2]?.trim() || 'play store';
    return {
      steps: [
        { action: 'open_store', payload: { store, query: item }, description: `Searching ${store} for ${item}` }
      ],
      response: `Searching for ${item} on the ${store} now.`
    };
  }

  // Pattern: Send message on [app] to [person]
  const whatsappMatch = text.match(/send\s+(?:a\s+)?(?:message|text)\s+on\s+(.+?)\s+to\s+(.+?)(?:\s+telling|that|saying|say|:)?\s+(.+)?$/i) ||
                       text.match(/(.+?)\s+par\s+(.+?)\s+ko\s+message\s+(?:karo|bhejo)(?:\s+ki|:)?\s+(.+)?$/i); // Hinglish: "Whatsapp par Rahul ko message bhejo ki hello"
  if (whatsappMatch) {
    const app = whatsappMatch[1].trim();
    const person = whatsappMatch[2].trim();
    const content = whatsappMatch[3]?.trim();
    return {
      steps: [
        { action: 'app_message', payload: { app, person, content }, description: `Messaging ${person} via ${app}` }
      ],
      response: content 
        ? `Ok. Sending "${content}" to ${person} on ${app}.` 
        : `Opening ${app} to message ${person}. What should I say?`
    };
  }

  // Pattern: Search contacts for [name] and [action]
  const contactActionMatch = text.match(/search\s+(?:for\s+)?(.+?)\s+and\s+(call|message|text|mail)\b/i);
  if (contactActionMatch) {
    const name = contactActionMatch[1].trim();
    const action = contactActionMatch[2].trim();
    return {
      steps: [
        { action: 'search_contact', payload: { name, nextAction: action }, description: `Searching for ${name} to ${action}` }
      ],
      response: `Looking for ${name} to ${action} them.`
    };
  }

  return null;
}

/**
 * Enhanced Entity Recognition: Extracts names and numbers from natural language.
 */
function extractEntity(text: string, settings: AssistantSettings, history: Message[]): { name?: string; number?: string; isSelfTargeted?: boolean } {
  const words = text.split(' ');
  
  // 1. Check for pronouns referring to history (Contextual Brain)
  if (text.match(/\b(him|her|them|that person|the contact|it)\b/i)) {
    // Look for previous assistant messages that mention contacts
    const historyReverse = [...history].reverse();
    const lastContactMsg = historyReverse.find(m => 
      m.role === 'assistant' && 
      (m.content.toLowerCase().includes('calling') || m.content.toLowerCase().includes('message to') || m.content.toLowerCase().includes('found'))
    );
    
    if (lastContactMsg) {
       // Extract name from "Calling John..." or "Ready to send to Sarah..."
       const match = lastContactMsg.content.match(/(?:calling|to|for|with|found)\s+([a-zA-Z\s]{2,20})/i);
       if (match) return { name: match[1].trim().replace(/[.,!?;]$/, '') };
    }
  }

  // 2. Fuzzy/Substring match for internal contacts
  const textLower = text.toLowerCase();
  const internalContacts = settings.contacts || [];
  
  // Try exact match first
  for (const contact of internalContacts) {
    if (textLower.includes(contact.name.toLowerCase())) {
      return { name: contact.name, number: contact.number };
    }
  }
  
  // Try partial word match
  const textWords = textLower.split(/\W+/);
  for (const contact of internalContacts) {
    const contactWords = contact.name.toLowerCase().split(/\W+/);
    if (contactWords.some(cw => cw.length > 2 && textWords.includes(cw))) {
       return { name: contact.name, number: contact.number };
    }
  }

  // 3. Extract direct numbers (7 to 15 digits)
  const numMatch = text.match(/(\+?[\d\s-]{7,15})/);
  if (numMatch && !text.includes('time')) return { number: numMatch[0].replace(/\s/g, '') };

  return {};
}

/**
 * LocalBrain V2: Refined Intent Engine
 */
export function parseLocalCommand(transcript: string, settings: AssistantSettings, history: Message[]): LocalAction {
  const text = transcript.toLowerCase().trim();
  const historySlice = history.slice(-8); // Slightly longer slice for better context
  
  // 0. Check for complex multi-step tasks first (Higher priority than general intent)
  const complexTask = extractTask(text);
  if (complexTask) {
    return {
      type: 'task',
      payload: { steps: complexTask.steps },
      response: complexTask.response,
      confidence: 0.95
    };
  }

  // High Priority: Confirm/Cancel (Reactive state)
  const confirms = ['yes', 'yeah', 'correct', 'do it', 'send', 'confirm', 'ok', 'okay', 'sure', 'yep', 'proceed'];
  const cancels = ['no', 'nope', 'cancel', 'stop', 'forget', 'nevermind', 'don\'t', 'negative'];
  
  const textFirstWord = text.split(' ')[0];
  if (confirms.includes(textFirstWord) && text.split(' ').length < 3) return { type: 'confirm', response: 'Proceeding.', confidence: 1 };
  if (cancels.includes(textFirstWord) && text.split(' ').length < 3) return { type: 'cancel', response: 'Task cancelled.', confidence: 1 };

  // Intent: System Management
  if (text.includes('clear') && (text.includes('chat') || text.includes('history') || text.includes('messages'))) {
    return { type: 'system', payload: { action: 'clear_history' }, response: 'History cleared.', confidence: 0.9 };
  }
  if (text.match(/\b(stop|silence|mute)\b/i) && text.match(/\b(speaking|audio|music|sound|voice)\b/i)) {
    return { type: 'system', payload: { action: 'stop_audio' }, response: 'Stopping audio.', confidence: 0.9 };
  }

  // Intent: Call
  if (text.match(/^(?:call|dial|phone|ring)\b/i)) {
    const entity = extractEntity(text, settings, historySlice);
    if (entity.number) {
       return { type: 'call', payload: { number: entity.number, name: entity.name || 'this number' }, response: `Calling ${entity.name || entity.number}...`, confidence: 0.95 };
    }
    
    // Extract target name if specific person mentioned but not in contacts
    const nameMatch = text.match(/^(?:call|dial|phone|ring)\s+(?:to\s+)?(.+)$/i);
    const targetName = entity.name || (nameMatch ? nameMatch[1].trim() : null);
    
    if (targetName && targetName.length > 1) {
       return { type: 'call', payload: { unknownName: targetName }, response: `Searching for ${targetName}... [AWAITING_REPLY]`, confidence: 0.8, searchPhone: true };
    }
  }

  // Intent: Message
  if (text.match(/^(?:message|sms|text|send\s+text)\b/i)) {
    const entity = extractEntity(text, settings, historySlice);
    const contentMatch = text.match(/(?:telling|saying|that|content|it)\s+(.+)$/i) || text.match(/(?:message|text)\s+.+?\s+(?:to\s+)?(.+)$/i);
    let content = contentMatch ? contentMatch[1].trim() : null;
    
    // Cleanup content if it captured the name
    if (content && entity.name && content.toLowerCase().startsWith(entity.name.toLowerCase())) {
        content = content.slice(entity.name.length).trim();
    }

    if (entity.number || entity.name) {
       return { 
         type: 'message', 
         payload: { number: entity.number, name: entity.name, content }, 
         response: content ? `Drafting message to ${entity.name || 'this contact'}: "${content}". Send? [AWAITING_REPLY]` : `What would you like to say? [AWAITING_REPLY]`, 
         confidence: 0.9,
         searchPhone: !entity.number && !entity.name
       };
    }
  }

  // Intent: Open / Utilities
  if (text.match(/^(?:open|start|go to|launch|visit|show)\b/i)) {
    const target = text.replace(/^(open|start|go to|launch|visit|show)\s+(?:me\s+)?/i, '').trim();
    const map: Record<string, string> = {
      'maps': 'https://maps.google.com', 'google': 'https://google.com', 'youtube': 'https://youtube.com',
      'weather': 'https://weather.com', 'calculator': 'https://www.google.com/search?q=calculator',
      'news': 'https://news.google.com', 'gmail': 'https://gmail.com'
    };
    if (map[target] || target.includes('.')) {
       return { type: 'open', payload: { url: map[target] || (target.startsWith('http') ? target : `https://${target}`) }, response: `Opening ${target}.`, confidence: 0.9 };
    }
  }

  // Intent: Time/Date (Instant)
  if (text.match(/\b(time|date|today|day)\b/i) && text.match(/\b(what|is|the|current)\b/i)) {
     const now = new Date();
     const isDate = text.includes('date') || text.includes('today') || text.includes('day');
     const resp = isDate 
        ? `Today is ${now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.`
        : `It is currently ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
     return { type: isDate ? 'date' : 'time', response: resp, confidence: 1 };
  }

  return { type: 'unknown', response: '', confidence: 0 };
}



