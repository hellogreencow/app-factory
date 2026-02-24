# iOS App Factory

An autonomous pipeline that builds real, working iOS apps through conversation. Describe an app in Telegram, and the factory scaffolds it, writes features with AI agents, runs QA, compiles it, takes simulator screenshots, and optionally ships to TestFlight.

Not mockups. Not templates. Working Expo (React Native) apps with real edit/delete, computed insights, functional settings, empty states, and domain-specific features.

## How it works

```
You (Telegram) → LLM router → Pipeline
                                 ↓
                     1. Scaffold (Expo project)
                     2. Template (5 architectures)
                     3. Feature spec + Maestro flows
                     4. npm install
                     5. LLM customization (theme, copy, seed data)
                     6. Feature enrichment (5-7 real features via code agent)
                     7. Taste review (copy + color polish)
                     8. QA (static analysis, auto-fix)
                     9. Bundle test (JS compilation)
                    10. Simulator screenshot
                                 ↓
                     App ready → Preview on phone or deploy to TestFlight
```

Every message goes through an LLM that decides whether to chat or act. The bot is a product designer first — it probes what you actually need, challenges obvious ideas, and shapes the concept before building.

## Quick start

### Prerequisites

- **macOS** (required for iOS simulator + Xcode toolchain)
- **Node.js 20+** (tested on 23.x)
- **Xcode** with iOS simulator runtimes
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI** (for deploys): `npm install -g eas-cli`

### 1. Clone and install

```bash
git clone https://github.com/yourusername/ios-app-factory.git
cd ios-app-factory
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env` with your keys:

| Variable | Required | Where to get it |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | [openrouter.ai/keys](https://openrouter.ai/keys) (free tier works) |
| `TELEGRAM_BOT_TOKEN` | Yes | Message [@BotFather](https://t.me/BotFather) on Telegram |
| `APPLE_ID` | For deploy | Your Apple Developer email |
| `EXPO_APPLE_TEAM_ID` | For deploy | developer.apple.com → Account → Membership |
| `EXPO_ASC_KEY_ID` | For deploy | App Store Connect → Users → Integrations → Keys |
| `EXPO_ASC_ISSUER_ID` | For deploy | Same page as above |
| `EXPO_ASC_API_KEY_PATH` | For deploy | Path to downloaded `.p8` key file |

The OpenRouter key and Telegram token are the only two needed to start building apps. Apple credentials are only required if you want to ship to TestFlight.

### 3. Start the bot

```bash
npm run bot
```

That's it. Open Telegram, message your bot, and describe an app. Or say "surprise me."

### 4. (Optional) Run the autonomous factory

The factory mode generates random apps continuously without user input:

```bash
npm run factory
```

## Architecture

### 5 app templates

Every app is routed to one of 5 architectures based on the idea:

| Architecture | Screens | Best for |
|---|---|---|
| **tracker** | Calendar, DayEntry, Stats, Settings | Habits, mood, fitness, daily logs |
| **dashboard** | Overview, AddEntry, History, Settings | Metrics, finance, health analytics |
| **feed** | Feed, Compose, Profile, Settings | Social, news, discovery, timelines |
| **reference** | Browse, ItemDetail, Bookmarks, Settings | Recipes, guides, catalogs, wikis |
| **generic** | List, AddItem, Detail, Settings | Everything else |

Each template includes a React Context with full CRUD (add, update, delete, clearAll), computed stats, and AsyncStorage persistence. The feature builder then adds 5 architecture-specific features on top.

### AI agent stack

| Agent | Role | Default model |
|---|---|---|
| **Conversation** | Routes chat vs. actions, shapes ideas | Gemini 2.0 Flash |
| **Idea generator** | Produces app spec from description | Gemini 3 Flash |
| **Customize** | Rewrites template to match domain/style | Gemini 3 Flash |
| **Feature builder** | Adds 5+ real features via code agent loop | Gemini 3 Flash |
| **Taste** | Polishes copy, colors, seed data | Gemini 3 Flash |
| **Code agent** | Iterative read/write/test loop for edits | Gemini 3 Flash |

Premium tier upgrades coding and generation to Claude Sonnet 4.6.

All models are accessed through OpenRouter. The free tier models (Gemini Flash) cost $0.

### Feature enrichment

After template + customization, the feature builder runs 5 directed tasks per architecture:

**Tracker example:**
1. Edit/delete entries with confirmation dialogs
2. Weekly mood indicator row with summary
3. Real stats: trends, longest streak, weekly patterns, days since first entry
4. Working settings: export data, clear all, reminder toggle, entry count
5. Empty states with onboarding guidance

Premium users also get 2 LLM-generated domain-specific features.

### QA pipeline

Every app goes through:
1. **Static analysis** — enum consistency, color contrast, navigation targets, testID coverage
2. **Flow audit** — Maestro E2E flow IDs verified against actual testIDs in code
3. **Auto-fix** — common issues patched automatically
4. **Bundle test** — `npx expo export` compiles JS (catches import/config errors)
5. **Simulator screenshot** — (optional) launches in Expo Go on headless sim

## Commands

```bash
npm run bot          # Start Telegram bot (primary interface)
npm run factory      # Autonomous mode: generate random apps continuously

# Manual pipeline steps
node orchestrator/functional-test.js apps/<slug>           # Run QA
node orchestrator/functional-test.js apps/<slug> --strict   # QA with strict mode
node orchestrator/expo-go-test.js apps/<slug>              # Bundle test only
node orchestrator/expo-go-test.js apps/<slug> --full       # Bundle + simulator screenshot
node orchestrator/feature-builder.js apps/<slug>           # Run feature enrichment
node orchestrator/code-agent.js apps/<slug> "add a search bar"  # Direct code edit

# Audit
bash scripts/audit.sh                        # Repo invariants check
bash scripts/audit.sh --pipeline-only        # Build + test one app
bash scripts/audit.sh --pipeline-only --arch tracker --full  # Full audit with simulator

# Deploy
bash scripts/deploy.sh <slug>               # Build + submit to TestFlight
bash scripts/deploy.sh <slug> --dry-run     # Validate without building
```

## Editing apps

From Telegram, just tell the bot what to change:

- "make the header blue"
- "add a search bar to the main screen"
- "the stats page feels empty, add more insights"

The code agent reads the app's files, makes changes, runs a bundle test, and shows you the result.

You can also edit directly:

```bash
node orchestrator/code-agent.js apps/my-app "add a dark mode toggle to settings"
```

## Project structure

```
ios-app-factory/
├── bot/
│   └── telegram.js          # Conversational Telegram bot
├── orchestrator/
│   ├── run-loop.js          # Autonomous pipeline loop
│   ├── idea-agent.js        # Idea generation
│   ├── template-copy.js     # Architecture routing
│   ├── feature-agent.js     # Feature spec generation
│   ├── feature-builder.js   # Real feature enrichment (5+ features per app)
│   ├── customize-agent.js   # LLM domain/style customization
│   ├── taste-agent.js       # Copy + color polish
│   ├── code-agent.js        # Iterative code editing agent
│   ├── functional-test.js   # Static analysis + auto-fix
│   ├── expo-go-test.js      # Bundle test + simulator screenshot
│   ├── flow-generator.js    # Maestro E2E flow generation
│   ├── flow-audit.js        # E2E flow ID verification
│   ├── audit-all.js         # Full system audit harness
│   ├── review-agent.js      # Pre-deploy audit
│   ├── asc-api.js           # App Store Connect API client
│   ├── submission-tracker.js # Polls Apple for submission status
│   └── lib/
│       ├── llm.js           # OpenRouter client
│       └── env.js           # .env loader
├── templates/
│   ├── tracker/             # Calendar + mood + stats
│   ├── dashboard/           # Metrics + chart + history
│   ├── feed/                # Posts + compose + profile
│   ├── reference/           # Browse + detail + bookmarks
│   └── generic/             # List + add + detail
├── scripts/
│   ├── scaffold-minimal.sh  # Create Expo project
│   ├── deploy.sh            # EAS Build + Apple upload
│   ├── audit.sh             # System audit wrapper
│   ├── lint.sh              # ESLint runner
│   └── setup.js             # Guided setup wizard
├── apps/                    # Generated apps live here
├── config/
│   └── eas.json             # EAS build/submit config template
├── benchmark/
│   ├── runs.json            # Pipeline timing data
│   └── idea-history.json    # Idea diversity tracking
├── .env.example             # Environment template
└── package.json
```

## OpenClaw integration

You can run the iOS App Factory as an [OpenClaw](https://docs.openclaw.ai) agent, giving your personal AI assistant the ability to build iOS apps on demand.

### Setup

1. Install OpenClaw: `npm install -g @anthropic/openclaw`
2. Clone this repo into your OpenClaw workspace (or symlink it)
3. Copy the provided SOUL.md into your OpenClaw config:

```bash
cp openclaw/SOUL.md ~/.openclaw/workspace/SOUL.md
cp openclaw/TOOLS.md ~/.openclaw/workspace/TOOLS.md
```

4. Configure the factory path in `openclaw.json`:

```json5
{
  agent: {
    workspace: "/path/to/ios-app-factory"
  },
  tools: {
    profile: "coding",
    allow: ["group:fs", "group:runtime", "group:sessions", "web_search"]
  }
}
```

5. Set your `.env` as described above

Now any OpenClaw channel (Telegram, Discord, Slack, WhatsApp, web UI) can trigger app builds. Tell your agent "build me a habit tracker" and it runs the full pipeline.

### How it works with OpenClaw

OpenClaw's `exec` tool runs the factory scripts. The SOUL.md configures the agent to:
- Parse natural language app requests
- Run `node orchestrator/code-agent.js` for edits
- Run the full pipeline via the bot or direct orchestrator calls
- Report results back through whatever channel you're using

This means you can control the factory from any platform OpenClaw supports — not just Telegram.

## Costs

| Component | Cost |
|---|---|
| OpenRouter (Gemini Flash models) | Free tier available |
| OpenRouter (Claude Sonnet 4.6) | ~$3/M tokens (premium only) |
| Apple Developer Program | $99/year (for TestFlight/App Store) |
| EAS Build (Expo) | Free tier: 30 builds/month |

Building apps with the free Gemini models costs $0 in API fees.

## Known constraints

- macOS required (iOS simulator + Xcode toolchain)
- First EAS build per project needs interactive credential setup
- Apple allows max 3 distribution certificates — the factory never auto-revokes
- App Store Connect API cannot create new apps (must be done manually or via first upload)
- Simulator screenshots require Expo Go installed on the simulator

## License

ISC
