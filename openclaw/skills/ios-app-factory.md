# Skill: iOS App Factory

Build real, working iOS apps through conversation. Uses an automated pipeline with AI agents for scaffolding, customization, feature enrichment, taste review, and QA testing.

## Commands

All commands go through the bridge script. Run from the factory root directory.

### Build a new app
```bash
node openclaw/bridge.js build "A mood journal that helps you see patterns in how you feel"
```
Returns JSON with the built app details, features list, and preview command.

### Edit an existing app
```bash
node openclaw/bridge.js edit my-app "add a search bar to the main screen"
```
Uses an AI code agent to make targeted edits, then runs QA.

### Test an app
```bash
node openclaw/bridge.js test my-app
```
Runs static analysis and bundle compilation.

### List all apps
```bash
node openclaw/bridge.js list
```

### Get app status
```bash
node openclaw/bridge.js status my-app
```

### Preview instructions
```bash
node openclaw/bridge.js preview my-app
```

## Workflow

When a user asks to build an app:
1. Use `build` with their description
2. Report the features that were built
3. Offer to edit, preview, or deploy

When a user asks to change an app:
1. Use `edit` with the slug and change description
2. Report what files changed

All output is JSON on stdout. Logs go to stderr.
