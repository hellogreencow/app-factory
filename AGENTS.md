# iOS App Factory — Project Memory

## Architecture

- **Pipeline (v6)**: `orchestrator/pipeline.js` owns the entire build lifecycle — zero UI knowledge
- Pipeline flow: Scaffold -> Design -> Generate (3 retries/screen) -> Repair stubs (code-agent, 2 rounds) -> Taste -> Strict QA (with auto-repair, 2 rounds) -> Screenshots
- Self-healing: if generator stubs screens, code-agent reads real codebase and rebuilds them; if QA fails, code-agent fixes errors and re-runs QA
- Every interface (Telegram, TUI, CLI, Web UI, OpenClaw) calls `pipeline.build(idea, opts)` and gets back a result object
- Bot (`bot/telegram.js`) is a thin Telegram skin: conversation router + result relay + preview/deploy management
- Each app lives in `apps/<slug>/` with `package.json`, `app.json`, `design.json`
- Scaffold installs 20+ Expo libraries plus Supabase client: maps, icons, gradients, haptics, camera, location, gestures, animations, SVG, @supabase/supabase-js, etc.
- Designer agent creates detailed app spec: screens, data model, navigation, features, libraries per screen
- App generator builds context -> App.js -> each screen one by one, bundle-checking after each
- Code-agent repairs: reads existing files, understands context/hook contracts, writes compatible code, runs bundle tests
- Model stack: hardcoded to `pro` tier — Claude Sonnet 4.6 (1M context) for design/codegen/repair, Gemini 3 Flash (1M context) for conversation/taste/idea. No tier selection UI; credits-based billing instead of tier switching
- Bot still supports `tier` command for override but web UI always uses pro
- TOKEN_BUDGETS in models.js caps per-role token spend: idea=512, design=3500, codegen=6000, repair=6000, conversation=700
- LLM client has retry logic (3 retries with exponential backoff on 429/timeout)

## Key Files

### Pipeline (the brain)
- `orchestrator/pipeline.js` — **self-healing build pipeline**: scaffold -> design -> generate -> repair -> taste -> QA -> repair -> screenshots. Interface-agnostic.
- `orchestrator/designer-agent.js` — generates complete app architecture as JSON
- `orchestrator/app-generator.js` — builds entire app from design.json with per-screen bundle checks and 3-attempt retries
- `orchestrator/runtime-qa.js` — general-purpose headless QA: static scan -> bundle check -> simulator launch -> Metro error detection -> exploratory UI taps via Maestro -> screenshot error overlay detection -> auto-fix loop
- `orchestrator/quality-gate.js` — unified gate with `strict` (static+bundle+runtime) and `preflight` (static+bundle) modes
- `orchestrator/taste-agent.js` — design review: critiques copy, colors, spacing; targeted find/replace edits
- `orchestrator/code-agent.js` — agentic code editor: LLM iterates with read/write/search/test tools
- `orchestrator/lib/llm.js` — OpenRouter client with retry on 429/5xx/timeout + SSE streaming via `chatStream()`
- `orchestrator/lib/docs-context.js` — Context7 integration: fetches live Expo/RN documentation for grounded code generation
- `orchestrator/lib/build-memory.js` — persistent build memory: tracks patterns, errors, fixes across sessions
- `orchestrator/lib/env.js` — loads `.env`, force-overwrites shell env

### Interfaces (thin skins)
- `web/server.js` — Full-screen web dashboard: Express + WebSocket + chat agent (/api/chat). LLM-powered conversation detects build intents via [BUILD:...] pattern. REST API for builds/screenshots. Auth endpoints use async `store` module.
- `web/public/index.html` — Split-panel futuristic UI: left = conversational agent (chat to build), right = phone frame preview with screenshots. Animated particle background, scanline overlay, Manrope font, dark monochrome palette.
- `web/public/studio.html` — 4-tab native-app-style UI: Studio (iPhone frame preview + thin chat), Apps (grid of built apps with status), History (build sessions timeline), Profile (auth, credits, settings, deploy config). Pull-up drawer for chat history + agent activity with swipe-to-dismiss. Bottom tab bar, Inter font, pure black palette. Mobile-first with safe area insets and PWA support.
- The factory builds its own iOS app: describe the factory as an app in the studio, pipeline generates an Expo app with WebView pointing at the hosted studio URL. Self-referential: the product builds itself
- `bot/telegram.js` — Telegram bot: conversation router (LLM decides chat vs action), calls pipeline.build(), manages preview/deploy
- `orchestrator/telegram-e2e.js` — headless black-box scenario runner for bot action paths
- `orchestrator/e2e-matrix.js` — one-command readiness runner for pipeline integration checks
- `openclaw/bridge.js` — CLI bridge for OpenClaw agents

### Data Layer
- `web/lib/supabase.js` — Supabase client (admin + anon). Falls back gracefully when env vars not set
- `web/lib/store.js` — Dual-mode store: Supabase when configured, local JSON files when not. All functions async. Handles auth, profiles, apps, builds, chat messages, screenshots
- `supabase/migrations/001_schema.sql` — Core schema: profiles (extends auth.users), apps, builds, chat_messages, screenshots. RLS policies, storage buckets, `deduct_credit` RPC function
- `supabase/migrations/002_chat_sessions.sql` — `list_chat_sessions` RPC for session grouping

### Scaffold & Deploy
- `scripts/scaffold-minimal.sh` — creates Expo project with full library palette (20+ packages)
- `scripts/deploy.sh` — EAS Build + Submit with API key auth
- `scripts/com.iosappfactory.bot.plist` — launchd agent runs bot; bot has internal file watcher for bot/orchestrator code edits

## Scaffold Library Palette

All installed via `npx expo install` during scaffold:
- expo-location, expo-camera, expo-haptics, expo-image-picker
- expo-linear-gradient, expo-blur, expo-clipboard, expo-sharing
- expo-file-system, expo-constants, expo-font, expo-asset
- @expo/vector-icons (Ionicons, MaterialIcons, FontAwesome, Feather)
- @react-navigation/native, native-stack, bottom-tabs
- react-native-maps, react-native-reanimated, react-native-gesture-handler
- react-native-svg, react-native-webview, react-native-screens, react-native-safe-area-context
- @react-native-async-storage/async-storage
- @supabase/supabase-js, react-native-url-polyfill
- date-fns, @expo/ngrok

## Known Issues & Constraints

- Expo SDK floor is now 54 for all newly scaffolded and pipeline-checked apps
- Node.js v23.3.0 — causes npm `directories` field to break installs
- expo-haptics does NOT have a valid config plugin — do NOT list it in app.json plugins
- expo-font MUST be installed as peer dep of @expo/vector-icons
- LLM-generated code frequently imports `uuid` — FORBIDDEN. Use `Date.now().toString(36) + Math.random().toString(36).slice(2)` instead
- LLM-generated code uses smart quotes (curly quotes) — sanitize all output
- OpenRouter free tier (Gemini 2.0 Flash) rate limits after ~10 requests/min — LLM client retries 3x
- Designer output may be truncated (>4096 tokens) — JSON repair handles unclosed brackets, strings, trailing commas
- Context value MUST include `theme: { backgroundColor, textColor, accentColor, cardColor }` when App.js uses `useContext` for theming — otherwise "Cannot read property '_context' of undefined"
- `newArchEnabled: true` must be in app.json for Expo Go compatibility (New Architecture mismatch warning)
- `catch {}` syntax (no error variable) is NOT supported by Hermes JS engine — always use `catch (e) {}`
- `new Date(invalidString)` returns Invalid Date, does NOT throw — validate with `isNaN(date.getTime())`
- Maestro cannot see React Native text inside Expo Go — use coordinate-based taps
- Metro `CI=true` env var disables watch mode — explicitly `delete env.CI`
- App Store Connect API does not support creating new apps via REST
- Apple allows max 3 distribution certificates — NEVER auto-revoke without user confirmation

## Fixes Applied

- [v11-web] Replaced 2s recursive sync file polling in `web/server.js` with `chokidar` event-driven watching + async file reads (`.js/.jsx/.json/.ts/.tsx`) to reduce event-loop stalls during builds/edits
- [v11-web] Added outbound WebSocket batching (40ms flush window) in `web/server.js` to cut per-step broadcast overhead under heavy pipeline activity
- [v11-web] Added raw progress transparency: `build:step` now includes `raw`, server emits `build:trace` when display text is transformed, and edit flow emits `edit:trace` tool events from `code-agent` (`onTool`)
- [v11-web] Frontend feed renderer now batches DOM inserts via `requestAnimationFrame` queue; reduced background particle count (55 -> 26) and timer tick frequency (1s -> 2s) for smoother UI under load
- [v11-ts] Added TypeScript foundation (`tsconfig.json`, `npm run typecheck`) and installed typing/tooling deps (`typescript`, `@types/node`, `@types/express`, `@types/ws`) for incremental JS->TS migration
- [v11-observe] Added live runtime telemetry (`system:metrics`) from `web/server.js` exposing queue depth, flush latency, ws clients, and event counters for objective UX/perf monitoring
- [v11-observe] UI preview panel now renders perf line (`#perfLine`) and richer trace rows (`trace/ok|fail`, tool name, path/pattern, duration) for transparent agent execution visibility
- [v11-ts] Added typed websocket contracts in `web/types/events.d.ts` as migration anchor for server/client event payloads
- [v11-web] Fixed startup resiliency: `web/server.js` now auto-falls to next port when 3700 is busy (`EADDRINUSE`) instead of crashing on launch
- [v11-web] Replaced `chokidar` v5 with `chokidar` v3.6.0 to remove Node 23 CommonJS->ESM experimental warnings from web server startup
- [v11-web] Added `wss.on('error')` guard for `EADDRINUSE` so WebSocketServer no longer crashes process before port-fallback retry executes
- [v11-web] Replaced retry-on-listen with deterministic pre-bind port probing (`net.createServer`) so startup picks one free port and logs exactly one dashboard URL
- [v11-web] Fixed chat contradiction: web chat now blocks `[BUILD:...]` execution when assistant reply is clarifying/question-form (`isClarifyingReply`), preventing “asks question + starts build” behavior
- [v11-web] Reduced feed noise by hiding successful trace spam by default; verbose trace stream now opt-in via `?trace=1` in dashboard URL
- [v11-web] Improved perceived progress clarity: phase changes now update preview status text (`phase: scaffold/design/generate/...`) during builds

- [v6] /restart loop: exit delayed 3s so polling lib can ack update; immediate exit caused Telegram to re-deliver and infinite restart loop
- [v6-sdk] Scaffold now uses Expo SDK ~54.0.0 minimum; pipeline enforces SDK floor and auto-resyncs core Expo deps if app is below 54
- [v6-sdk] Removed stale SDK 52 dependency pinning in template-copy/review-agent; dependency repair now uses `npx expo install` for SDK-compatible versions
- [v6-bot] Added deterministic pipeline-health response path for “is the build pipeline ensured/ready/healthy” style questions
- [v6-preview] Hardened Expo tunnel startup: parse URL from Expo logs + retry tunnel 3x with ngrok reinstall/self-heal before failing preview
- [v6-preview] If tunnel retries fail, bot automatically falls back to LAN preview QR (same Wi‑Fi) instead of hard failing
- [v6-preview] Fixed SplitSnap preview blocker: invalid `package.json` main (`expo-router/entry`) now auto-corrected to `index.js` for non-router apps in bot preview + pipeline
- [v6-bot] Added deterministic `preview ...` text command routing (bypasses LLM action formatting, same reliability model as `edit ...`)
- [v6-gate] Quality gate now auto-installs missing deps: (a) app.json config-plugin packages, (b) packages imported in source but missing from node_modules — prevents Expo config/plugin crashes and “Unable to resolve module …” preflight failures

- [v2] Templates replaced with ground-up generation: designer-agent + app-generator
- [v2] Scaffold upgraded: 20+ Expo libraries installed by default
- [v2] LLM client: retry logic with exponential backoff on 429/timeout
- [v2] Designer JSON repair: handles truncated output, removes trailing commas, strips comments
- [v2] App generator: skip-if-exists for context/App.js, per-screen bundle check, 3 attempts per screen
- [v3-qa] runtime-qa.js: general-purpose headless QA with Maestro exploratory taps and red screen pixel detection
- [v3-gate] quality-gate.js unified gate; bot build/edit/preview/deploy enforce shared quality standards
- [v3-telegram] Safe message chunking, throttled progress, plain text fallback
- [v3-process] Per-chat subprocess registry with deterministic stop/cancel
- [v4-matrix] e2e-matrix.js one-command readiness runner
- [v4-telegram-e2e] Headless bot scenario testing
- [v5-mvp-gate] Generator enforces no-stub + 100% screen pass for production builds
- [v5-auto-repair] Pipeline self-heals: code-agent repairs stubs and QA failures automatically
- [v6-refactor] Extracted `orchestrator/pipeline.js` — bot is now a thin interface. Pipeline is self-healing, interface-agnostic, and reusable by TUI/CLI/OpenClaw
- [v6-refactor] Bot reduced from ~1370 lines of mixed logic to clean interface layer calling `pipeline.build()`
- [v6-refactor] Pipeline verified end-to-end: SplitSnap built 6/6 screens (3 repaired from stubs), strict QA passed, 7 screenshots, 388s total
- [v6-compat] Added newArchEnabled to scaffold and pipeline; app-generator now enforces context must include theme object for App.js useContext
- [v6-compat] Fixed pipeline-test-01: AppContext missing theme caused _context undefined crash; scaffold + generator hardened
- Session persistence: bot sessions saved to `.sessions.json`, restored on restart
- Smart quote sanitization in customize-agent, taste-agent, code-agent
- Preview via Expo Go: tunnel server, QR code generation, lifecycle management
- LAN fallback: if ngrok tunnel fails, bot falls back to LAN + Tailscale QR codes
- Tailscale support: `getTailscaleIPv4()` detects Tailscale IP; LAN preview includes Tailscale QR
- Tunnel self-heal: `purgeUnresolvableDevDeps()` strips @types/* and test devDeps that block expo start (npm peer dep conflict). Runs in both `startExpoTunnelWithRetry` and `quality-gate` preflight

## Fixes Applied

- pipeline-test-01 (SplitSnap): removed @types/jest, @types/react, jest, jest-expo, react-test-renderer, typescript from devDependencies — they caused "added as dependency but not installed" expo start failure due to npm peer dep version conflicts
- quality-gate.js: `purgeUnresolvableDevDeps` now runs as first preflight step (before plugin/import checks)
- bot/telegram.js: `startExpoTunnelWithRetry` detects "added as dependency but not installed" error, calls `purgeUnresolvableDevDeps`, retries immediately
- [v7-web] Added web UI: Express + WebSocket server (`web/server.js`), dark dashboard (`web/public/index.html`) with real-time pipeline viz, logs, screenshots, build history
- [v8-web] Rebuilt web UI as agent-style coding interface: full-screen split-panel layout (activity feed + phone preview), file watcher broadcasts every file written during build as collapsible code blocks, structured WebSocket events (build:step/build:file/build:phase/build:design), animated particle background, JetBrains Mono for code, Manrope for body
- [v8-web] Agent prompt fix: prevented re-triggering builds when user asks about already-built apps
- [v8-web] File watcher filters out package-lock.json noise; design event fires during design phase not at end
- [v8-web] E2E verified: full build session (NearFear) -- 27 file events, 56 agent steps, 4 phases, 5/5 screens, 7 screenshots, 486s. Concurrent build rejection, empty input rejection, post-build chat all passing
- [v8-web] Preview panel now shows live Expo Go QR code (LAN mode), not static screenshots. Auto-starts after successful build, persists across page reloads
- [v8-web] Server-side preview: `startExpoServer()` with manifest polling, LAN IP discovery via `REACT_NATIVE_PACKAGER_HOSTNAME`, CI env removal
- [v8-web] Endpoints: POST `/api/preview/start`, POST `/api/preview/stop`, GET `/api/preview/status` (includes qrDataUrl)
- [v8-web] NearFear app fixes: broken import path in PlaceDetailsScreen (`../src/context/` → `../context/`), review data model (strings → objects), PlaceDetailsScreen wired into navigation via NativeStackNavigator, null guards on `.map()` calls, stale AsyncStorage migration
- [v9-web] Preview is now real Expo Go session (QR code over LAN), not static screenshots. Auto-starts after build, persists across page reloads
- [v9-web] Session-based architecture: each browser session tracks one app context, supports building + editing via code agent
- [v9-web] Edit flow: chat agent detects `[EDIT:...]` intent, runs code-agent on current session app. File watcher broadcasts changes. Metro hot-reloads automatically
- [v9-web] Auth scaffolded: signup/login/logout/me endpoints with SHA-256 password hashing, JSON file store in `.data/`
- [v9-web] Credits model: free (3/mo, 2 apps), premium (20/mo, 10 apps), genius (100/mo, unlimited apps). Monthly auto-reset
- [v9-web] Sleeker input bar: unified container with integrated SVG send arrow, focus glow effect
- [v9-web] E2E verified: TickTock timer app built (5 screens, 56 steps, 389s), preview auto-started, edit flow tested (color + font change, 37s, 12 steps)
- [v10-web] Removed model tier selection from web UI. Hardcoded to `pro` tier (Claude Sonnet). Credits-based billing, not tier switching
- [v10-web] Feed scroll fixed: `flex:1 1 0;min-height:0` ensures proper overflow without compression. Items are `flex-shrink:0`
- [v10-web] Agent feed shows richer step types: `read` (file reads/searches), `tool` (screen building), `think` (design/thinking), `write`, `cmd`, `repair`, `retry`
- [v10-web] E2E verified: DreamDrift built (6 screens, 6/6 passed, 771s), preview auto-started with QR code, feed scrolled properly through entire build
- [v10-web] Preview panel restructured: phone shows "live" status card (app name + click-to-open-web-preview), QR code displayed below phone frame
- [v10-web] Web preview: Expo serves web via react-native-web on same port. Auto-installed during preview startup. Opens in new browser tab on click
- [v10-web] Build messages transformed to tool-use format: "Writing screen: X", "Thinking: designing architecture...", "Running bundle check...", "Reading source files..."
- [v10-web] File events now show "Wrote: path (N lines)" step before each collapsible file block
- [v10-web] Manifest polling fixed: Expo returns text/plain not application/json for manifest with expo-platform header; now parses text as JSON instead of checking content-type
- [v10-web] E2E verified: FocusFlow built (5 screens, 20 steps, 19 files, 673s), preview launched with both exp:// and web URLs
- [v7-harden] designer-agent.js: added 3-attempt retry with escalating temperature on validation failure (parse failure, too few screens, no tabs)
- [v7-harden] runtime-qa.js: simulator unavailability now correctly returns `runtimeOk: false` + error instead of faking success
- [v7-harden] pipeline.js: QA/repair crashes now accumulate real errors instead of creating fake success objects; all catch blocks push to result.errors
- [v7-harden] llm.js: timeout retries now use escalating backoff delay (5s/10s/20s) instead of immediate retry
- runtime-qa.js: switched QA from `--no-dev` to dev mode — in `--no-dev`, JS runtime errors are silently swallowed; dev mode surfaces them in Metro logs and as red overlays
- runtime-qa.js: parseMetroErrors now captures `console.error` lines forwarded from device in dev mode (critical for catching async data errors)
- runtime-qa.js: staticScan now detects unsafe `.map()/.filter()` on state/context arrays missing null guards
- app-generator.js: codegen prompt hardened with rules: nav params guard (`route?.params ?? {}`), no empty catch, function existence guards, no-truncation mandate
- [v11-ux] Web UI rebuilt: typing indicator (animated dots), example prompt chips ("pomodoro timer", "dog walk tracker", "recipe box", "surprise me"), phase progress bar with pips, per-phase step/file summary, cancel button in top bar, removed debug perf-line from default view
- [v11-ux] Chat agent prompt tightened: shorter routing rules, explicit "do not build when reply is a question" guard
- [v11-ux] `isClarifyingReply` fixed: now checks only if the last sentence ends with `?` instead of any `?` anywhere (was blocking builds when LLM reply contained rhetorical questions)
- [v11-agent] code-agent.js: added `search_replace` tool for targeted edits (find/replace blocks instead of full-file rewrites), added few-shot example in system prompt
- [v11-agent] code-agent.js: added path safety (`safePath` rejects writes outside appDir), context pruning (prunes old file reads when context exceeds 120k chars)
- [v11-agent] code-agent.js: smart-quote sanitization extracted to `sanitizeSmartQuotes()` helper used by both `write_file` and `search_replace`
- [v11-llm] llm.js: added 5xx retry with backoff (500/502/503 now retry 3x like 429 and timeout)
- [v11-infra] Replaced swallowed empty catch blocks in designer-agent, quality-gate, pipeline with structured stderr logging
- [v12-models] Upgraded model tiers: pro now uses `anthropic/claude-sonnet-4.6` (1M context, SWE-Bench 72.7%) for design/codegen/repair, `google/gemini-3-flash-preview` (1M context, $0.50/M) for conversation/taste/idea. Eco/standard upgraded to Gemini 3 Flash from Gemini 2.0 Flash
- [v12-models] Fixed DEFAULT_TIER to `'pro'` — was `'eco'` despite AGENTS.md documenting "hardcoded to pro"
- [v12-context7] Added `orchestrator/lib/docs-context.js`: fetches live Expo/React Native documentation from Context7 API (11,747 indexed code snippets). Caches responses for 10 minutes to avoid redundant calls
- [v12-context7] Designer agent now fetches navigation docs from Context7 and appends them to the design prompt as reference patterns
- [v12-context7] App generator now fetches per-screen library docs based on each screen's `features.libraries` array (e.g. maps screen gets MapView patterns, animation screen gets Reanimated patterns)
- [v12-streaming] Added `chatStream()` to `orchestrator/lib/llm.js`: SSE streaming client that calls `onChunk(delta)` for each token, enabling real-time output
- [v12-streaming] Web chat agent now uses streaming: server broadcasts `chat:typing`, `chat:delta`, `chat:done` events over WebSocket as tokens arrive
- [v12-streaming] Frontend renders streaming tokens character-by-character into a live agent message block, strips [BUILD:...]/[EDIT:...] tags from visible output in real-time
- [v12-agent] code-agent.js: added `takeSnapshot()` and `restoreSnapshot()` for undo capability — snapshots all src/*.js files before any edit session
- [v12-memory] Added `orchestrator/lib/build-memory.js`: persistent JSON store (.data/build-memory.json) that tracks successful design patterns, common errors and their fixes, and build statistics
- [v12-memory] Pipeline records successful builds and app generator injects top-10 known error patterns into codegen prompts for avoidance
- [v12-memory] Build memory grows across sessions — system gets smarter with each build
- [v13-backend] Added Supabase backend support: scaffold now installs `@supabase/supabase-js` + `react-native-url-polyfill` in every app
- [v13-backend] Designer agent now outputs `backend` section in design.json: `type` (supabase|local), `auth` (bool), `tables` (schema), `storage` (bool), `realtime` (bool)
- [v13-backend] App generator auto-creates `src/lib/supabase.js` (client init with AsyncStorage session persistence) and `src/context/AuthContext.js` (signup/signin/signout/onAuthStateChange) when backend.type=supabase
- [v13-backend] Context generation prompt now uses Supabase CRUD (`.from().select/insert/update/delete`) when backend is supabase, falls back to AsyncStorage when URL is placeholder
- [v13-backend] App.js generation wraps with `AuthProvider` when backend.auth=true, shows login screen for unauthenticated users
- [v13-backend] Codegen rules updated to allow `@supabase/supabase-js` as a valid import
- [v14-studio] Added `/studio` route and `web/public/studio.html`: 4-tab native-app-style product UI
- [v14-studio] Studio tab: iPhone frame preview (hero, scales 280-360px by screen height), thin chat bar at bottom, chat preview line, pull-up drawer with chat/activity tabs, swipe-to-dismiss, device pulse animation during builds
- [v14-studio] Apps tab: grid of built apps with first-letter icon, status dot (ok/fail/building), screen count, duration. Tap to load preview and auto-switch to Studio
- [v14-studio] History tab: chronological build timeline with status dots, relative timestamps (just now/5m/2h/3d), tap to reload preview
- [v14-studio] Profile tab: auth forms (signup/login with toggle), logged-in view with avatar, tier badge, credits/apps stats, settings section (theme, style, auto-preview, notifications), deploy config (Apple Developer Team, TestFlight), sign-out
- [v14-studio] Bottom tab bar with SVG icons: Studio (phone), Apps (grid), History (clock), You (person)
- [v14-studio] PWA-ready: apple-mobile-web-app-capable, safe area insets, viewport-fit=cover
- [v15-stack] Added Supabase as the platform database: `@supabase/supabase-js` installed for server-side, `web/lib/supabase.js` client with admin/anon modes
- [v15-stack] Rewrote `web/lib/store.js` as dual-mode async store: Supabase when `SUPABASE_URL`+`SUPABASE_SERVICE_KEY` are set, local JSON fallback otherwise. All store functions now async
- [v15-stack] Schema: `profiles` (extends auth.users with tier/credits), `apps` (per-user with design JSON), `builds` (status/duration/result), `chat_messages` (per-user per-session), `screenshots` (metadata + storage bucket). Full RLS policies
- [v15-stack] `deduct_credit` Postgres function handles atomic credit decrement with monthly auto-reset
- [v15-stack] Storage buckets: `screenshots` (public), `app-source` (private) with appropriate policies
- [v15-stack] Auth endpoints in `web/server.js` refactored to async, using `store.signUp`/`store.signIn`/`store.getProfileBySession`
- [v15-scaffold] Added `react-native-webview` to scaffold palette and designer/codegen allowed imports — enables WebView-based apps including the factory building itself
- [v15-self] Deleted hand-coded `shell-app/` — the factory will build its own iOS app through the studio, not via manual code
- [v16-frontend] Replaced raw HTML studio with React + TypeScript + Vite + Tailwind CSS v4 frontend (`web/frontend/`)
- [v16-frontend] Zustand state management with typed WebSocket event handling for all server events
- [v16-frontend] Components: Layout (tab bar), PhonePreview (iPhone frame + iframe + QR), ChatInput/ChatMessages, AgentPanel (expandable trace/file detail), FileExplorer (tree + code preview)
- [v16-frontend] Pages: Studio (split layout: phone + chat/agent/files tabs), Apps (grid), History (timeline), Profile (auth + tier + settings)
- [v16-frontend] Production build: 267KB JS (84KB gzip), 19KB CSS (4.6KB gzip), Vite v7
- [v16-frontend] Server updated: serves `frontend/dist/` when built, falls back to `public/` for legacy, SPA routing via catch-all
- [v16-frontend] TypeScript strict mode, path aliases (@/), all WebSocket events typed

## Data Layer

### Server-Side Supabase
- `web/lib/supabase.js` — admin (service key, RLS bypass) + anon (publishable key) clients
- `web/lib/store.js` — dual-mode async store: Supabase when configured, local JSON fallback
- `supabase/migrations/001_schema.sql` — profiles, apps, builds, chat_messages, screenshots tables + RLS + storage buckets
- `supabase/migrations/002_chat_sessions.sql` — `list_chat_sessions` helper function

### Frontend TypeScript
- `web/frontend/src/types/events.ts` — all WebSocket event types
- `web/frontend/src/types/index.ts` — User, Build, ChatMessage, AgentAction, PreviewState types
- `web/frontend/src/hooks/useAppStore.ts` — Zustand store handling all server events
- `web/frontend/src/hooks/useSocket.ts` — auto-reconnecting WebSocket with typed events
- `web/frontend/src/lib/api.ts` — typed REST API client

## Coding Standards

- No emoji in code or comments unless user requests
- Comments explain non-obvious intent only, not narration
- All scripts must be `chmod +x`
- All child process calls must be async (spawn, not spawnSync)
- Test IDs: use `testID` and `accessibilityLabel` on all interactive elements
- NEVER import uuid, axios, lodash, moment — only use installed packages from scaffold
- Generated code must use only packages from the scaffold library palette
