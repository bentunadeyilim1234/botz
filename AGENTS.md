# BotZ Network - AI Agent Documentation

## Project Overview

BotZ Network (also referred to as "K-Botter") is a high-performance Kahoot botting platform built with Next.js. It uses the `kahoot.js-updated` library to create concurrent WebSocket connections to Kahoot game sessions, allowing users to deploy multiple bot instances simultaneously.

**Key Purpose**: Educational tool for stress-testing Kahoot sessions with mass concurrency (100+ bots).

**Important Disclaimer**: This project is intended strictly for educational purposes and stress-testing your own systems only.

---

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js | 16.1.6 |
| React | React / React DOM | 19.2.3 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | v4 |
| UI Animation | Framer Motion | ^12.34.3 |
| Icons | Lucide React | ^0.575.0 |
| Kahoot Engine | kahoot.js-updated | ^3.404.1 |
| Package Manager | pnpm | (workspace enabled) |
| Compiler | Babel React Compiler | 1.0.0 |

---

## Project Structure

```
/home/tuna/botz-1/
├── src/
│   └── app/
│       ├── layout.tsx              # Root layout with Inter & Outfit fonts
│       ├── page.tsx                # Main UI - bot deployment form & logs
│       ├── globals.css             # Tailwind v4 CSS with custom theme
│       ├── manifest.ts             # PWA manifest
│       ├── favicon.ico
│       ├── faq/page.tsx            # FAQ page
│       ├── privacy/page.tsx        # Privacy policy page
│       ├── terms/page.tsx          # Terms of service page
│       └── api/
│           ├── engine.ts           # Core AutomationEngine class
│           ├── stream/route.ts     # SSE endpoint for real-time logs
│           └── tasks/
│               ├── start/route.ts  # POST: Start bot task
│               ├── abort/route.ts  # POST: Abort running task
│               └── answer/route.ts # POST: Submit answers to active question
├── public/
│   ├── icon-192x192.png
│   └── icon-512x512.png
├── package.json
├── pnpm-workspace.yaml           # pnpm workspace config
├── next.config.ts                # Next.js config (standalone output)
├── tsconfig.json                 # TypeScript config with path aliases
├── eslint.config.mjs             # ESLint with Next.js configs
├── postcss.config.mjs            # PostCSS with Tailwind v4
├── global.d.ts                   # Type declarations for kahoot.js-updated
├── Dockerfile                    # Multi-stage Docker build
└── .gitignore
```

---

## Architecture Details

### Frontend (Next.js App Router)

- **Route Structure**: Uses Next.js 15+ App Router with API routes
- **State Management**: React hooks (useState, useEffect) - no external state library
- **Real-time Communication**: Server-Sent Events (SSE) via `/api/stream`
- **UI Design**: Dark theme with purple accents, glassmorphism effects

### Backend (API Routes)

All API routes use a **global singleton pattern** to persist the `AutomationEngine` across hot reloads:

```typescript
const globalForEngine = global as unknown as { engine: AutomationEngine };
const engine = globalForEngine.engine || new AutomationEngine();
if (process.env.NODE_ENV !== "production") globalForEngine.engine = engine;
```

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stream` | GET | SSE stream for real-time logs and events |
| `/api/tasks/start` | POST | Start bot deployment task |
| `/api/tasks/abort` | POST | Abort running task by taskId |
| `/api/tasks/answer` | POST | Submit answer index for all bots |

#### SSE Events

The stream emits these event types:
- `log` - Log messages with timestamps
- `task_started` - Task initialization confirmation
- `task_completed` - Task finished normally
- `task_aborted` - Task was manually aborted
- `task_error` - Task encountered an error
- `question_active` - Kahoot question started (triggers answer UI)
- `question_ended` - Kahoot question ended

### Core Engine (`/src/app/api/engine.ts`)

The `AutomationEngine` class manages:
- **Active Clients**: Map of taskId → Kahoot client instances
- **Abort Signals**: Map of taskId → AbortController for graceful shutdown
- **Event Emitter**: Custom event system for SSE communication
- **Concurrency**: Spawns N Kahoot clients with 50ms stagger to avoid rate limits
- **Auto-cleanup**: 10-minute hard timeout to prevent zombie processes

Each client:
1. Generates random suffix for username (e.g., `BotName-a3f9`)
2. Connects to Kahoot game via WebSocket (COMETD)
3. Listens for events: Joined, QuizStart, QuestionStart, QuestionEnd, Disconnect
4. Waits for manual answer commands (interactive mode)

---

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Development server (runs on localhost:3000)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

---

## Configuration Files

### next.config.ts
- Output: `standalone` (for Docker deployment)
- React Compiler: enabled
- `serverExternalPackages`: Includes `kahoot.js-updated` (native module)

### tsconfig.json
- Target: ES2017
- Path alias: `@/*` → `./src/*`
- Strict mode enabled
- Module resolution: bundler

### Tailwind CSS v4 (globals.css)
Uses new Tailwind v4 `@import` and `@theme` syntax:
- Custom CSS variables for colors
- Custom utilities: `.glass-panel`, `.glass-button`, `.text-gradient`
- Dark theme with radial gradient backgrounds

### pnpm-workspace.yaml
- Ignores built dependencies: esbuild, sharp, unrs-resolver
- Links workspace packages

---

## Deployment

### Docker Deployment

Multi-stage Dockerfile:
1. **Builder stage**: Installs dependencies with pnpm, builds Next.js
2. **Runner stage**: Minimal alpine image with standalone output

```bash
docker build -t botz-network .
docker run -p 3000:3000 botz-network
```

**Important**: The app runs on port 3000. For full functionality, you may need to expose additional ports if running a separate backend (original README mentions port 3001 for Fastify, but current implementation uses Next.js API routes only).

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` or `development` |
| `PORT` | Server port (default: 3000) |
| `HOSTNAME` | Bind address (default: 0.0.0.0) |
| `NEXT_TELEMETRY_DISABLED` | Set to `1` to disable Next.js telemetry |

---

## Code Style Guidelines

### TypeScript
- Strict mode enabled - all code must be type-safe
- Use path aliases (`@/app/...`) for imports
- Explicit return types on exported functions

### React
- All components are functional components
- Use `"use client"` directive for client-side interactivity
- Hooks follow React 19 patterns

### CSS/Styling
- Tailwind CSS utility classes preferred
- Custom styles in `globals.css` using `@layer utilities`
- Glassmorphism effect: `bg-black/50 backdrop-blur-xl border border-white/10`
- Color scheme: Dark background (#050505), purple accents (#a855f7)

### API Routes
- Use `export const dynamic = 'force-dynamic'` for non-cached routes
- Global singleton pattern for stateful engine persistence
- JSON responses with consistent `{ success: boolean, ... }` shape

---

## Testing

**No formal test suite is currently configured.** The project does not include:
- Jest configuration
- Playwright test configuration (despite using Playwright as a dependency name, the engine uses kahoot.js-updated, not Playwright browser automation)
- Cypress or other E2E tools

Manual testing is done through the UI at the root path.

---

## Security Considerations

1. **Rate Limiting**: No built-in rate limiting on API endpoints
2. **Proxy Support**: Code includes `useProxy` parameter but proxy implementation is not fully visible in the current codebase (mentioned in README as configurable in `engine.ts`)
3. **Input Validation**: Basic validation on API routes (taskId required, answerIndex required)
4. **Auto-timeout**: 10-minute hard limit on tasks to prevent resource exhaustion
5. **CORS**: Not explicitly configured (relies on Next.js defaults)

**Warning**: Deploying this tool publicly without additional security measures could lead to abuse. Consider adding:
- Authentication/authorization
- Rate limiting per IP
- Maximum thread limits per request

---

## Key Dependencies Notes

### kahoot.js-updated
- Uses CommonJS (`require()`) instead of ES modules to avoid Turbopack bundling issues
- Type declarations provided in `global.d.ts`
- Marked as `serverExternalPackages` in Next.js config

### eventsource
- Used on the client for SSE connection to `/api/stream`
- Polyfill for EventSource with better browser compatibility

---

## Troubleshooting

### Common Issues

**Module not found: kahoot.js-updated**
- The engine uses `require()` to import this CJS module
- Ensure it's listed in `serverExternalPackages` in `next.config.ts`

**SSE connection drops**
- The stream sends ping comments every 15 seconds to keep connection alive
- `X-Accel-Buffering: no` header prevents NGINX buffering

**Task state lost on redeploy**
- State is in-memory only (global singleton)
- Serverless deployments (Vercel) will lose state between invocations
- Use Docker deployment for persistent state

---

## Future Considerations

The README mentions features not yet fully implemented:
- Full proxy rotation system
- nixpacks.toml for Coolify deployment
- Video demonstration

When modifying code, ensure the SSE event structure remains compatible with the frontend's event handling in `page.tsx`.
