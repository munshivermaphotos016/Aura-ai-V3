import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import ytSearch from "youtube-search-api";
import { Readable } from "stream";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  app.use(express.json());

  // Proxy endpoint to bypass X-Frame-Options and CORS
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl || targetUrl === "undefined" || targetUrl === "null" || targetUrl === "https://") return res.status(400).send("No valid URL provided");

    try {
      new URL(targetUrl); // Validate first
    } catch {
      return res.status(400).send(`Invalid URL: ${targetUrl}`);
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const contentType = response.headers.get("content-type") || "";

      // We only strip headers that block embedding
      const omitHeaders = [
        "x-frame-options",
        "content-security-policy",
        "strict-transport-security",
        "transfer-encoding",
        "content-encoding",
        "content-length",
      ];

      response.headers.forEach((value, key) => {
        if (!omitHeaders.includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      res.status(response.status);

      // If it's HTML, inject base tag and interceptors
      if (contentType.includes("text/html")) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        let html = buffer.toString("utf-8");
        const finalUrl = response.url || targetUrl; // Use final URL after redirects
        const parsedUrl = new URL(finalUrl);
        const baseTag = `<base href="${parsedUrl.protocol}//${parsedUrl.host}/">`;

        // Inject script to hijack clicks, forms, fetch, and XHR
        const hijackScript = `
          <script>
            // Hijack navigation
            document.addEventListener('click', function(e) {
              const a = e.target.closest('a');
              if (a && a.href && !a.href.startsWith('javascript:')) {
                e.preventDefault();
                window.parent.postMessage({ type: 'AURA_NAVIGATE', url: a.href }, '*');
              }
            });
            document.addEventListener('submit', function(e) {
              e.preventDefault();
              let url = e.target.action || window.location.href;
              const formData = new FormData(e.target);
              const params = new URLSearchParams();
              for (const [key, value] of formData) {
                params.append(key, value);
              }
              if (e.target.method.toLowerCase() === 'get') {
                url = url.split('?')[0] + '?' + params.toString();
              }
              window.parent.postMessage({ type: 'AURA_NAVIGATE', url: url }, '*');
            });

            // Intercept Fetch API
            const originalFetch = window.fetch;
            window.fetch = async function() {
              let [resource, config] = arguments;
              let absoluteUrl = '';
              if (typeof resource === 'string') {
                absoluteUrl = new URL(resource, document.baseURI).href;
              } else if (resource instanceof Request) {
                absoluteUrl = new URL(resource.url, document.baseURI).href;
              }
              if (absoluteUrl && absoluteUrl.startsWith('http')) {
                const proxiedUrl = window.location.origin + '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                if (typeof resource === 'string') resource = proxiedUrl;
                else resource = new Request(proxiedUrl, resource);
              }
              return originalFetch.apply(this, [resource, config]);
            };

            // Intercept XMLHttpRequest
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              let absoluteUrl = '';
              if (typeof url === 'string') {
                 absoluteUrl = new URL(url, document.baseURI).href;
              }
              if (absoluteUrl && absoluteUrl.startsWith('http')) {
                url = window.location.origin + '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
              }
              return originalXhrOpen.apply(this, [method, url, ...Array.prototype.slice.call(arguments, 2)]);
            };
          </script>
        `;

        if (html.includes("<head>")) {
          html = html.replace("<head>", `<head>\n${baseTag}\n${hijackScript}`);
        } else {
          html = baseTag + hijackScript + html;
        }
        res.send(html);
      } else {
        if (response.body) {
          Readable.fromWeb(response.body as any).pipe(res);
        } else {
          const arrayBuffer = await response.arrayBuffer();
          res.send(Buffer.from(arrayBuffer));
        }
      }
    } catch (e: any) {
      console.error(e);
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #334155; }
            .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; text-align: center; border: 1px solid #e2e8f0; }
            h2 { color: #ef4444; margin-top: 0; }
            p { font-size: 0.95rem; line-height: 1.5; margin-bottom: 0; word-break: break-all; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">🌐</div>
            <h2>Page Not Available</h2>
            <p>Failed to load: <strong>${targetUrl}</strong></p>
            <p style="margin-top: 1rem; font-size: 0.85rem; color: #64748b;">${e?.message || 'Connection refused or invalid URL'}</p>
          </div>
        </body>
        </html>
      `;
      res.status(500).send(errorHtml);
    }
  });

  // Native YouTube Search Proxy
  app.get("/api/yt-search", async (req, res) => {
    const q = req.query.q as string;
    if (!q) return res.status(400).send("No query");
    try {
      const result = await ytSearch.GetListByKeyword(q, false, 15);
      // Format to our standard
      const items = result.items
        .map((item: any) => ({
          videoId: item.id,
          title: item.title,
          durationStr: item.length?.simpleText,
          thumbnail: item.thumbnail?.thumbnails?.[0]?.url,
          author: item.channelTitle,
        }))
        .filter((v: any) => v.videoId && v.title && v.videoId.length === 11);

      res.json(items);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Proxy for Custom API providers (OpenAI compatible)
  app.post("/api/llm-proxy", async (req, res) => {
    try {
      const { url, headers, body } = req.body;
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else {
        const text = await response.text();
        res.status(response.status).send(text);
      }
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: { message: e.message } });
    }
  });

  // Proxy for Fetching LLM Models
  app.post("/api/llm-models-proxy", async (req, res) => {
    try {
      const { url, headers } = req.body;
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else {
        const text = await response.text();
        res.status(response.status).send(text);
      }
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: { message: e.message } });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
