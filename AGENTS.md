# iOS App Factory — Project Memory

## Architecture

- Async pipeline: Idea -> Scaffold -> Feature -> Flow -> Lint -> ExpoTest -> Review -> E2E -> Deploy -> Track -> Notify
- All stages use async `spawn` (not `spawnSync`) — output streams to stdout for TUI consumption
- Each app lives in `apps/<slug>/` with its own `package.json`, `app.json`, `features.json`, Maestro flows
- 5 architectures: feed, dashboard, tracker, reference, generic — selected by `idea.architecture`
- Templates in `templates/{feed,dashboard,tracker,reference,generic}/` each with App.js, context, screens
- TUI: `tui.js` — pure Node.js, zero deps, ANSI animations, reads `benchmark/runs.json` live
- Telegram bot: `bot/telegram.js` — conversational LLM-driven interface (Gemini 2.0 Flash for routing)
- Bot is NOT command-based; every message goes through an LLM that decides actions vs. chat
- Model stack: conversation=Gemini 2.0 Flash, coding=Gemini 3 Flash, taste=Gemini 3 Flash, premium=Claude Sonnet 4.6
- Factory root ESLint: `node_modules/.bin/eslint` at `8.57.0` — apps inherit via `scripts/lint.sh`

## Key Files

- `orchestrator/run-loop.js` — main async pipeline loop
- `orchestrator/idea-agent.js` — idea generation with `architecture` field, diversity tracked in `benchmark/idea-history.json`
- `orchestrator/feature-agent.js` — writes features.json based on architecture
- `orchestrator/template-copy.js` — routes to correct template dir by architecture
- `orchestrator/flow-generator.js` — generates per-architecture Maestro YAML flows
- `orchestrator/fix-agent.js` — parses E2E failures, patches flows
- `orchestrator/benchmark.js` — logs per-stage timing/results to `benchmark/runs.json`
- `orchestrator/e2e-runner.js` — simctl-based E2E fallback when Maestro fails
- `orchestrator/expo-go-test.js` — Level 1: bundle export (7s), Level 2: Expo Go on headless sim (60s)
- `orchestrator/submission-tracker.js` — polls Expo GraphQL API for submission status, notifies on completion/failure
- `orchestrator/review-agent.js` — pre-deploy audit (config, deps, credentials, ASC state)
- `orchestrator/asc-api.js` — App Store Connect API client (JWT auth, bundle ID/app lookup)
- `orchestrator/lib/llm.js` — OpenRouter client
- `orchestrator/lib/env.js` — loads `.env`, force-overwrites shell env
- `scripts/deploy.sh` — EAS Build + Submit with API key auth, non-interactive, --no-wait
- `scripts/eas-build-interactive.exp` — expect script for first-time EAS credential setup
- `scripts/eas-submit-2fa.exp` — expect script for interactive submit with 2FA dialog
- `scripts/eas-submit-create.exp` — expect script for interactive submit + app creation
- `bot/telegram.js` — conversational Telegram bot; LLM router decides chat vs. action per message
- `openclaw/bridge.js` — CLI bridge for OpenClaw agents: build/edit/test/list/status/preview commands, returns JSON
- `openclaw/SOUL.md` — OpenClaw agent personality config
- `openclaw/TOOLS.md` — OpenClaw tool guide for the factory
- `openclaw/setup.sh` — one-command setup: clone + install + configure OpenClaw + prompt for API keys
- `orchestrator/customize-agent.js` — LLM rewrites context/seed data + screens to match idea domain/style
- `orchestrator/functional-test.js` — static analysis (enum consistency, color contrast, nav targets) + bundle test + auto-fix
- `orchestrator/code-agent.js` — agentic code editor: LLM iterates with read/write/search/test tools until task is done
- `orchestrator/feature-builder.js` — post-template enrichment: 5 architecture-specific features (edit/delete, real stats, working settings, empty states, domain-unique) + 2 LLM-generated domain features for premium; uses code-agent loop per feature
- `orchestrator/taste-agent.js` — design review agent: critiques copy, colors, seed data, empty states; makes targeted find/replace edits to elevate feel
- `orchestrator/flow-audit.js` — static verifier: Maestro flow `id:` steps must exist in code (testID/tabBarButtonTestID), supports template-literal ids
- `orchestrator/audit-all.js` — paranoid audit harness: repo invariants + end-to-end pipeline build/test (optional simulator + native E2E)
- `scripts/audit.sh` — one-command wrapper for `audit-all.js`

## Known Issues & Constraints

- Expo SDK 52 requires: react-native-screens ~4.4.0, react-native-safe-area-context 4.12.0, async-storage 1.23.1
- Node.js v23.3.0 — causes npm `directories` field to break installs (removed from root package.json)
- ESLint v9 has breaking flat-config change — pinned at v8.57.0
- Maestro 2.x XCUITest driver broken on Xcode 26.2; factory uses `e2e-runner.js` (simctl) as fallback
- App Store Connect API does not support creating new apps via REST — apps must be created in ASC web UI or via first Xcode/Transporter upload; API key role is Admin
- Apple allows max 3 distribution certificates — NEVER auto-revoke without user confirmation
- First EAS build per project needs interactive mode for credential setup; after that non-interactive works
- EAS free tier has queue delays (5-10 min); builds take ~5 min on server
- `app.json` must set `ITSAppUsesNonExemptEncryption: false` and `owner: "olimorley"` before EAS build
- `eas submit` MUST have ascApiKeyPath/ascApiKeyIssuerId/ascApiKeyId in eas.json submit profile — without it, falls back to Apple ID auth which triggers interactive sign-in + 2FA
- `eas submit --no-wait` is required — without it, the command blocks 5-30 min polling Apple's Transporter; Apple processing happens server-side
- EAS free tier submission queue: 30-60+ min, NEVER use it — submit directly via `xcrun altool` (36s)
- Direct Apple upload: download IPA from EAS build URL, then `xcrun altool --upload-app` with API key
- expect `exp_continue` resets the timeout counter — use wall-clock checks (clock seconds) for hard timeouts
- deploy.sh injects API key + ascAppId into eas.json submit profile at runtime from env vars
- Expo GraphQL API at api.expo.dev/graphql, auth via sessionSecret from ~/.expo/state.json
- Submission statuses: AWAITING_BUILD -> IN_QUEUE -> IN_PROGRESS -> FINISHED/ERRORED/CANCELED
- Multiple queued submissions cause backlog — cancel stale ones before submitting new
- `npx expo export` is a fast (7s) bundle check that catches JS/import/config errors before deploying

## Fixes Applied

- eas.json submit profile: added ascApiKeyPath, ascApiKeyIssuerId, ascApiKeyId — eliminates Apple ID auth entirely
- deploy.sh: auto-injects ASC API key into submit profile from EXPO_ASC_* env vars
- deploy.sh: bypasses EAS submit entirely — downloads IPA, uploads direct to Apple via `xcrun altool` (36s vs 30-60+ min EAS queue)
- run-loop.js: deploy timeout increased from 600s to 1800s (EAS free tier can take 20+ min for build)
- run-loop.js: deploy stage streams output to stdout for TUI visibility
- run-loop.js: added ExpoTest stage (bundle export check) before deploy — blocks deploy if JS doesn't compile
- run-loop.js: spawns detached submission-tracker after successful deploy for async status tracking + notifications
- submission-tracker.js: polls Expo GraphQL every 30s, notifies via macOS notification on status changes
- submission-tracker.js: auto-cancels stale submissions (>60 min) before tracking to prevent queue bloat
- eas-submit-create.exp + eas-submit-2fa.exp: replaced exp_continue timeout with wall-clock hard timeout
- mythology-travel-planner/eas.json: configured with ascAppId + API key for non-interactive submit
- bot/telegram.js: LLM-driven conversational bot (Gemini 2.0 Flash, free fallback: Llama 3.3 70B)
- Bot pipeline: scaffold -> template -> feature/flows -> npm install -> LLM customize -> **feature enrichment** -> taste review -> QA/auto-fix -> bundle test -> simulator screenshot
- Bot shows typing indicator throughout all processing (re-sent every 4s)
- If LLM-customized code breaks the bundle, auto-reverts to template code and retries
- functional-test.js catches: invisible text (white-on-white), mood enum mismatches, missing nav targets, broken hook imports
- functional-test.js auto-fixes: headerTintColor contrast, mood value mismatches vs canonical MOODS array
- customize-agent.js prompts now enforce: keep MOODS values identical, one seed entry per key, no field renames
- Bot deploy is non-blocking: streams milestone detection, heartbeat every 3 min, timeout at 30 min
- Webhook server on port 9100: POST /eas-webhook for EAS build callbacks, GET /health for status
- Bot conversation phases: exploring -> refining (with REFINE drafts) -> building -> ready
- [ACTION:generate] removed — "surprise me" now goes through [ACTION:custom:...] so the LLM-described idea and the built app are always the same
- Preview action sends real screenshots + text instructions; LLM told NOT to hallucinate QR codes/links
- taste-agent.js: Gemini 3 Flash reviews copy/colors/seed for soul; 5-15 targeted edits per app, ~5s runtime
- Model upgrade: all code/customize/taste agents now use Gemini 3 Flash ($0.50/M) as default; premium uses Claude Sonnet 4.6 ($3/M)
- Templates: bottom tabs now set `tabBarButtonTestID` so E2E flows tap tabs by id (not brittle text)
- Flow generator now prefers ids and falls back to text for legacy apps; avoids coupling E2E to copy changes
- functional-test.js strict mode now audits Maestro flow ids + enforces testID/accessibilityLabel on interactive elements
- deploy.sh: added `--dry-run` to validate env/ASC lookup/eas.json config without building or uploading
- feature-builder.js: builds 5 real features per architecture via directed code-agent loop (~96s total, 0 failure rate on tracker)
- Template contexts upgraded: all 5 architectures now export edit/delete/update/clearAll/computed stats in context files
- Feature enrichment transforms template shells into apps with: working settings (export, clear, prefs), edit/delete, real stats (trends, streaks, patterns), empty states with onboarding, weekly summaries
- Premium tier also gets 2 LLM-designed domain-specific features per app
- OpenClaw integration: bridge.js exposes build/edit/test/list/status/preview as JSON CLI commands; SOUL.md + TOOLS.md configure agent personality and tool knowledge
- README.md written for open-source users: quick start, architecture, commands, OpenClaw integration, cost breakdown

## Coding Standards

- No emoji in code or comments unless user requests
- Comments explain non-obvious intent only, not narration
- All scripts must be `chmod +x`
- All child process calls must be async (spawn, not spawnSync)
- Test IDs: use `testID` and `accessibilityLabel` on all interactive elements in templates
- Maestro flows: always use `extendedWaitUntil` with explicit timeouts, never assume data exists
