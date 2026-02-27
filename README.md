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
