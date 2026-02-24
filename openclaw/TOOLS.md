# iOS App Factory — Tool Guide

You have shell access to the iOS App Factory pipeline. Here's how to use it.

## Building a new app

To build an app from a description, run the full pipeline:

```bash
# 1. Generate idea spec
node orchestrator/idea-agent.js --custom "A mood journal that helps you see patterns"

# 2. Or run the Telegram bot (handles everything):
npm run bot
```

For direct pipeline control, chain the stages:

```bash
SLUG="my-app"
ARCH="tracker"  # or: dashboard, feed, reference, generic

# Scaffold
bash scripts/scaffold-minimal.sh $SLUG

# Template
node orchestrator/template-copy.js apps/$SLUG $ARCH

# Feature spec
node orchestrator/feature-agent.js apps/$SLUG $ARCH '{"name":"My App","description":"...","architecture":"tracker","domain":"wellness","twist":"minimal"}'

# Install deps
cd apps/$SLUG && npm install && cd ../..

# Customize (LLM rewrites theme/copy)
node orchestrator/customize-agent.js apps/$SLUG $ARCH '{"name":"My App","description":"...","architecture":"tracker","domain":"wellness","twist":"minimal"}'

# Feature enrichment (5+ real features)
node orchestrator/feature-builder.js apps/$SLUG '{"name":"My App","description":"...","architecture":"tracker","domain":"wellness","twist":"minimal"}'

# Taste polish
node orchestrator/taste-agent.js apps/$SLUG '{"name":"My App","description":"...","architecture":"tracker","domain":"wellness","twist":"minimal"}'

# QA
node orchestrator/functional-test.js apps/$SLUG --strict

# Bundle test
node orchestrator/expo-go-test.js apps/$SLUG
```

## Editing an existing app

Use the code agent for targeted edits:

```bash
node orchestrator/code-agent.js apps/<slug> "add a search bar to the main screen"
node orchestrator/code-agent.js apps/<slug> "make the header blue and add a subtitle"
node orchestrator/code-agent.js apps/<slug> "the stats screen needs trend analysis"
```

The code agent reads files, makes changes, and runs a bundle test to verify.

## Running tests

```bash
# Static analysis + auto-fix
node orchestrator/functional-test.js apps/<slug>
node orchestrator/functional-test.js apps/<slug> --strict

# Bundle compilation
node orchestrator/expo-go-test.js apps/<slug>

# Bundle + simulator screenshot
node orchestrator/expo-go-test.js apps/<slug> --full

# Full system audit
bash scripts/audit.sh
bash scripts/audit.sh --pipeline-only --arch tracker
```

## Deploying to TestFlight

```bash
# Dry run (validates config without building)
bash scripts/deploy.sh <slug> --dry-run

# Real deploy
bash scripts/deploy.sh <slug>
```

Requires Apple Developer credentials in .env.

## Listing apps

```bash
ls apps/
```

Each app directory contains the full Expo project, features.json, Maestro flows, and test screenshots.

## Architecture choices

Use these when building:
- **tracker** — Calendar + daily log + stats (habits, mood, fitness)
- **dashboard** — Metrics overview + add entry + history (finance, health)
- **feed** — Scrollable posts + compose + profile (social, news)
- **reference** — Browse + detail + bookmarks (recipes, guides, catalogs)
- **generic** — List + add + detail (everything else)

## Environment

The factory needs OPENROUTER_API_KEY in .env (free tier works). Apple credentials are only needed for TestFlight deployment. Check .env.example for all variables.
