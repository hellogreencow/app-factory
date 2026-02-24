# Autonomous App Factory Loop

## Architecture

```
[Idea Agent] → [Scaffold] → [Feature*] → [Flow] → [E2E] → [Deploy]
     ↓              ↓            ↓          ↓        ↓         ↓
  Novel idea    scaffold-    Template   Maestro   maestro   EAS Submit
  (domains +    minimal.sh   copy or    YAML      test      (Phase 3)
  formats +                  LLM
  twists)
```

\* Feature: crypto domain uses template copy from crypto-portfolio; other domains need LLM (TODO).

## Components

| Component | Path | Purpose |
|-----------|------|---------|
| Idea Agent | `orchestrator/idea-agent.js` | Generates novel app ideas (domain + format + twist) |
| Scaffold | `scripts/scaffold-minimal.sh` | Creates minimal Expo app |
| Template Copy | `orchestrator/template-copy.js` | Copies full impl for crypto domain |
| Flow Generator | `orchestrator/flow-generator.js` | Generates Maestro YAML from features |
| Benchmark | `orchestrator/benchmark.js` | Logs per-stage results |
| Run Loop | `orchestrator/run-loop.js` | Orchestrates full pipeline |

## Usage

```bash
# Single run (3 apps by default)
./scripts/run-factory.sh

# Continuous mode (loop until max)
./scripts/run-factory.sh --continuous --max 5

# With E2E (builds native app, runs Maestro; ~5 min per app)
MAX_APPS=1 node orchestrator/run-loop.js --e2e

# With E2E + Deploy (after pass, eas build + submit)
MAX_APPS=1 node orchestrator/run-loop.js --e2e --deploy

# Force specific idea
IDEA_JSON='{"name":"crypto-tracker","slug":"crypto-tracker","domain":"crypto","features":["portfolio-view","add-asset","price-chart","settings"]}' MAX_APPS=1 node orchestrator/run-loop.js

# Benchmark report
node orchestrator/benchmark.js report
```

## Benchmark Metrics

- `benchmark/runs.json`: per-run logs (idea, scaffold, feature, flow, e2e)
- `node orchestrator/benchmark.js report`: summary (total_runs, scaffold_ok, e2e_ok, success_rate)

## Novel Idea Generation

Idea agent combines:
- **Domains**: crypto, sci-fi, fitness, productivity, reading, gaming, social
- **Formats**: tracker, reader, journal, dashboard, explorer, collector
- **Twists**: minimal, dark-mode, offline-first, gamified, AI-assisted

Set `OPENAI_API_KEY` and use `--llm` for LLM-generated ideas (TODO).

## Fix Agent

- Parses Maestro stderr (timeout, notFound, assertionFailed)
- Patches flows: double timeout, id→text for add-asset
- E2E loop retries up to 3x with fixes

## Deploy

- `./scripts/deploy.sh crypto-portfolio`: eas build + submit
- `--deploy` flag: run after E2E pass (requires --e2e)
- Set APPLE_ID, ASC_APP_ID, APPLE_TEAM_ID for submit

## Next: Full Autonomy

1. **LLM Feature Agent**: Generate screens for non-crypto domains
2. **LLM Idea Agent**: OPENAI_API_KEY + --llm for novel combinations
