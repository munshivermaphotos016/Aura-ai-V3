import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { systemPrompt } from "./prompts";
import { AssistantSettings } from "../types";

export async function processWithCloudEngine(
  text: string,
  settings: AssistantSettings,
  messageHistory: { role: string; content: string }[],
  memory: Record<string, any> = {},
  base64Image: string | null = null
) {
  try {
    const selectedId = settings.selectedProviderId || "default";

    const memoryContext =
      Object.keys(memory).length > 0
        ? `\n\nLONG-TERM MEMORY (User preferences, key details, reminders):\n${JSON.stringify(memory, null, 2)}`
        : "";

    const timeContext = `\n\nCURRENT DEVICE TIME AND DATE:\n${new Date().toLocaleString()}\n\nCRITICAL SEARCH TOOL INSTRUCTION:\nYou MUST use your Google Search tool to fetch the absolute latest information for any real-time, time-sensitive, or live event queries (e.g., live cricket/sports scores, news, weather, stock prices).\nEven if the user asks for an update immediately after a previous question, DO NOT guess or rely on your previous response. ALWAYS perform a new search to get the exact current status/score before answering!`;

    if (selectedId !== "default") {
      const provider = settings.customProviders.find(
        (p) => p.id === selectedId,
      );

      // Fallback to legacy field if list is empty but old config exists
      const config = provider || {
        baseUrl: settings.cloudEngine.baseUrl,
        apiKey: settings.cloudEngine.apiKey,
        modelName: settings.cloudEngine.modelName,
        name: "Custom",
      };

      if (!config.baseUrl) {
        return "Please configure the Base URL for your custom cloud engine in Settings.";
      }

      const contactContext =
        settings.contacts?.length > 0
          ? `\n\nUSER CONTACTS:\n${settings.contacts.map((c) => `- ${c.name}: ${c.number}`).join("\n")}`
          : "";

      const permissionsContext = `
      
SYSTEM PERMISSIONS (Simulated):
- Contacts API: ${settings.permissions?.contacts ? "Granted" : "Denied"}
- Calling: ${settings.permissions?.call ? "Granted" : "Denied"}
- SMS: ${settings.permissions?.sms ? "Granted" : "Denied"}
- App Open Intents: ${settings.permissions?.apps ? "Granted" : "Denied"}
- Accessibility: ${settings.permissions?.accessibility ? "Granted" : "Denied"}
- Audio/Microphone: ${settings.permissions?.audio ? "Granted" : "Denied"}
- Camera: ${settings.permissions?.camera ? "Granted" : "Denied"}
- Location/GPS: ${settings.permissions?.location ? "Granted" : "Denied"}
- Storage/Files: ${settings.permissions?.storage ? "Granted" : "Denied"}
- System Overlay: ${settings.permissions?.overlay ? "Granted" : "Denied"}

If the user asks you to perform an action but they haven't granted the necessary permission in the system settings, you can politely inform them to enable it in the 'System Permissions' settings menu first. However, if they have granted it, proceed WITH NO HESITATION.
      `;

      const formattedMessages = [
        {
          role: "system",
          content:
            systemPrompt +
            memoryContext +
            contactContext +
            timeContext +
            permissionsContext,
        },
        ...messageHistory.map((m) => ({ role: m.role, content: m.content })),
      ];

      const userMessageContext: any = { role: "user", content: [] };
      if (base64Image) {
        userMessageContext.content.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        });
      }
      userMessageContext.content.push({ type: "text", text: text });
      
      formattedMessages.push(userMessageContext);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      }

      let cleanBaseUrl = (config.baseUrl || "").trim().replace(/\/$/, "");
      if (!cleanBaseUrl) {
        throw new Error("Base URL is empty. Please set a valid API Base URL in Settings.");
      }
      if (!cleanBaseUrl.startsWith("http")) {
        cleanBaseUrl = "https://" + cleanBaseUrl;
      }

      if (
        cleanBaseUrl.includes("cloudflare.com") &&
        cleanBaseUrl.endsWith("/ai")
      ) {
        cleanBaseUrl += "/v1";
      }

      let endpoint = cleanBaseUrl;
      if (
        !endpoint.endsWith("/chat/completions") &&
        !endpoint.endsWith("/generate") &&
        !endpoint.includes("/run/")
      ) {
        endpoint = endpoint + "/chat/completions";
      }

      let response: Response;
      let modelName = config.modelName || "gpt-3.5-turbo";
      if (cleanBaseUrl.includes("cloudflare.com") && !modelName.startsWith("@")) {
        modelName = "@cf/meta/" + modelName;
      }

      const payload = {
        model: modelName,
        messages: formattedMessages,
        max_tokens: 2000,
        temperature: 0.8,
        safe_prompt: false,
        safety_settings: "none",
        top_p: 0.95
      };

      if (
        cleanBaseUrl.includes("localhost") ||
        cleanBaseUrl.includes("127.0.0.1")
      ) {
        response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/llm-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: endpoint,
            headers,
            body: payload,
          }),
        });
      }

      if (!response.ok) {
        let errBody = "";
        try {
          errBody = await response.text();
        } catch (e) {}

        if (
          errBody.includes("No route for that URI") &&
          cleanBaseUrl.includes("cloudflare.com")
        ) {
          throw new Error(
            "Cloudflare Error: 'No route for that URI'.\n" +
              "Please check your Base URL and Model Name:\n" +
              "1. Ensure you replaced 'YOUR_ACCOUNT_ID' with your actual Cloudflare Account ID format: https://api.cloudflare.com/client/v4/accounts/<id>/ai/v1\n" +
              "2. Verify the model name exists (e.g. @cf/meta/llama-3-8b-instruct).",
          );
        }

        if (
          response.status === 404 &&
          cleanBaseUrl.includes("groq.com") &&
          !cleanBaseUrl.includes("openai/v1")
        ) {
          throw new Error(
            "Groq Error: Unknown Request URL.\n" +
              "Please change your Base URL in Settings to: https://api.groq.com/openai/v1",
          );
        }

        let customErrMsg = `Custom API error: ${response.status} ${response.statusText}. `;
        if (errBody) {
          try {
            const parsed = JSON.parse(errBody);
            customErrMsg +=
              parsed.error?.message || parsed.error || JSON.stringify(parsed);
            if (parsed.errors)
              customErrMsg += " " + JSON.stringify(parsed.errors);
          } catch {
            customErrMsg += errBody.substring(0, 200);
          }
        }
        throw new Error(customErrMsg);
      }

      const data = await response.json();
      if (data.result && data.result.response) return data.result.response;
      return (
        data.choices?.[0]?.message?.content ||
        "I didn't receive a valid response from the cloud."
      );
    } else {
      // Default: Gemini with Search Grounding
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const userParts: any[] = [];
      if (base64Image) {
        userParts.push({
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg",
          },
        });
      }
      userParts.push({ text: text });

      const formattedContents = [
        ...messageHistory.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: userParts },
      ];

      const contactContext =
        settings.contacts?.length > 0
          ? `\n\nUSER CONTACTS:\n${settings.contacts.map((c) => `- ${c.name}: ${c.number}`).join("\n")}`
          : "";

      const permissionsContext = `
      
SYSTEM PERMISSIONS (Simulated):
- Contacts API: ${settings.permissions?.contacts ? "Granted" : "Denied"}
- Calling: ${settings.permissions?.call ? "Granted" : "Denied"}
- SMS: ${settings.permissions?.sms ? "Granted" : "Denied"}
- App Open Intents: ${settings.permissions?.apps ? "Granted" : "Denied"}
- Accessibility: ${settings.permissions?.accessibility ? "Granted" : "Denied"}
- Audio/Microphone: ${settings.permissions?.audio ? "Granted" : "Denied"}
- Camera: ${settings.permissions?.camera ? "Granted" : "Denied"}
- Location/GPS: ${settings.permissions?.location ? "Granted" : "Denied"}
- Storage/Files: ${settings.permissions?.storage ? "Granted" : "Denied"}
- System Overlay: ${settings.permissions?.overlay ? "Granted" : "Denied"}

If the user asks you to perform an action but they haven't granted the necessary permission in the system settings, you can politely inform them to enable it in the 'System Permissions' settings menu first. However, if they have granted it, proceed WITH NO HESITATION.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview", // Uncensored highest intelligence
        contents: formattedContents,
        config: {
          systemInstruction:
            systemPrompt +
            memoryContext +
            contactContext +
            timeContext +
            permissionsContext,
          temperature: 0.7,
          tools: settings.webSearchEnabled ? [{ googleSearch: {} }] : undefined,
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
          ],
        },
      });

      return response.text;
    }
  } catch (err: any) {
    console.error("Cloud engine error:\n" + JSON.stringify(err));
    const errString =
      (err.message || "") +
      " " +
      (err.status || "") +
      " " +
      JSON.stringify(err);
    
    if (
      errString.includes("429") ||
      errString.includes("quota") ||
      errString.includes("RESOURCE_EXHAUSTED")
    ) {
      return "I'm sorry, but my cloud engine has exceeded its rate limit quota. You can use the Settings > Secrets panel to select a billing enabled Gemini API key, or configure a Custom Provider in Settings.";
    }
    return (
      "I encountered a problem connecting to the cloud engine. " +
      (err.message || "")
    );
  }
}
