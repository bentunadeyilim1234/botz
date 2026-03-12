# BotZ: Kahoot Botting Software

*(TBA)*

BotZ is a high-performance, threaded Playwright execution engine built to simulate advanced web interactions at scale. It securely and rapidly automates joining sessions, retaining contexts, and clicking dynamic elements all while preserving a low hardware footprint.

> **Disclaimer:** This project is intended strictly for educational purposes and stress-testing your own systems.

## 🚀 Features

- **Mass Concurrency:** Spin up 100+ bot threads simultaneously without crashing your host system.
- **Resource Optimized:** Automatically intercepts and blocks all images, media, stylesheets, and fonts in Chromium to save massive amounts of RAM and CPU.
- **Anti-Ban Proxies:** Built-in proxy rotation lets you securely obfuscate node origins.
- **Live Terminal Logs:** A beautiful, retro-tech style UI streams WebSocket logs from the Fastify backend directly to your browser.
- **Auto-Cleanup:** All stranded Chromium instances are automatically killed after a hardcoded 10-minute timeout to clear active memory.

---

## 🛠️ Tech Stack
- Frontend: **Next.js 14**, **Tailwind CSS**, Lucide Icons
- Backend: **Fastify**, Fastify WebSocket, Fastify CORS
- Engine: **Playwright** (Chromium headless)

---

## 📦 Installation & Setup

### Local Development

1. **Clone & Install Dependencies**
   ```bash
   pnpm install
   ```
2. **Setup Playwright Browsers**
   ```bash
   npx playwright install chromium
   ```
3. **Run the Project**
   This repository uses `concurrently` to boot the Next.js frontend and Fastify backend automatically with one command.
   ```bash
   pnpm run dev
   ```
   *Frontend starts on `http://localhost:3000`*
   *Backend starts on `http://localhost:3001`*

---

## ☁️ Deployment (Coolify)

K-Botter comes pre-configured with a `nixpacks.toml` file to ensure a seamless deployment setup in **Coolify**.

1. Connect your repository to Coolify.
2. Select **Nixpacks** as the build engine.
3. Coolify will automatically read the `nixpacks.toml`. This installs necessary system libraries needed to run Playwright headlessly (`nixPkgs = ["playwright"]`).
4. Ensure your Coolify deployment exposes **both** ports (e.g., `3000` for Next.js, and map `3001` for the Fastify WebSocket).

---

## 🎥 Video Demonstration

*(TBA)*

---

### How to configure Proxies?
If you toggle "Use Proxy" in the UI, K-Botter reads from an array of proxies configured inside `engine.ts` (`defaultProxies`). Open the file and insert your IP:PORT combos to instantly secure your traffic!

---

## ⚠️ Vercel Deployment Limitations & Workarounds

When deploying to Vercel, be aware of these limitations:

### 1. **Serverless Function Timeout (10-60 seconds)**
Vercel's Hobby plan limits serverless functions to 10 seconds (Pro: 60 seconds, Enterprise: 900 seconds). Since Kahoot sessions can last much longer, this causes premature disconnections.

**Workarounds:**
- **Upgrade to Vercel Pro** - Increases timeout to 60s per function
- **Use Vercel Edge Functions** - Lower latency but still time-limited
- **Deploy on Docker/Railway/Render** - These platforms don't have strict timeouts
- **Use Coolify on your own VPS** - Full control, no timeouts

### 2. **Cold Starts**
Serverless functions spin down after inactivity, causing delays on next request.

**Workarounds:**
- **Cron Job Keep-Alive** - Ping your `/api/stream` endpoint every 5 minutes:
  ```javascript
  // vercel.json
  {
    "crons": [{
      "path": "/api/keep-alive",
      "schedule": "*/5 * * * *"
    }]
  }
  ```
- **Vercel Pro** - Has warmer functions with reduced cold start times

### 3. **WebSocket/SSE Limitations**
Vercel's serverless architecture doesn't support persistent WebSocket connections well.

**Workarounds:**
- **Use Server-Sent Events (SSE)** - Already implemented in `/api/stream`
- **Add Reconnection Logic** - Client auto-reconnects on disconnect
- **Use a separate Node.js server** - Run the engine on a persistent server (Railway, Render, VPS)

### Recommended Architecture for Vercel
```
┌─────────────────┐      SSE      ┌─────────────────────┐
│  Next.js on     │ ◄────────────►│  Node.js/Persistent │
│  Vercel (UI)    │               │  Server (Engine)    │
└─────────────────┘               └─────────────────────┘
                                         │
                                    WebSocket
                                         │
                                    ┌────┴────┐
                                    │  Kahoot │
                                    │ Servers │
                                    └─────────┘
```

This hybrid approach keeps the fast UI on Vercel while running the long-lived engine on a persistent server.
