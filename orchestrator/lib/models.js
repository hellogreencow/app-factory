/**
 * Model tier configuration.
 *
 * Three tiers, each mapping a functional role to a specific model:
 *
 *   eco      — token-efficient defaults. Gemini Flash across the board.
 *              Same quality bar, tighter prompts and max_tokens.
 *
 *   standard — step up for design + code roles. Gemini 2.5 Flash where
 *              reasoning depth improves output without big cost jump.
 *
 *   pro      — maximum quality. Claude Sonnet for design and code.
 *              Conversation stays cheap (Flash) — no value in paying more there.
 *
 * Roles:
 *   conversation — bot chat, intent routing, quick replies
 *   design       — app architecture, screen spec, JSON output
 *   codegen      — screen code generation (large outputs)
 *   repair       — code-agent fix loops, bundle/QA repair
 *   taste        — UI critique and targeted text/color edits
 *   idea         — idea generation, short structured JSON
 */

const TIERS = {
  eco: {
    conversation: 'google/gemini-2.5-flash-lite',
    design:       'google/gemini-3-flash-preview',
    codegen:      'google/gemini-3-flash-preview',
    repair:       'google/gemini-3-flash-preview',
    taste:        'google/gemini-2.5-flash',
    idea:         'google/gemini-2.5-flash-lite',
  },
  standard: {
    conversation: 'google/gemini-2.5-flash',
    design:       'google/gemini-3-flash-preview',
    codegen:      'google/gemini-3-flash-preview',
    repair:       'google/gemini-3-flash-preview',
    taste:        'google/gemini-3-flash-preview',
    idea:         'google/gemini-2.5-flash',
  },
  pro: {
    conversation: 'google/gemini-3-flash-preview',
    design:       'anthropic/claude-sonnet-4.6',
    codegen:      'anthropic/claude-sonnet-4.6',
    repair:       'anthropic/claude-sonnet-4.6',
    taste:        'google/gemini-3-flash-preview',
    idea:         'google/gemini-3-flash-preview',
  },
};

const DEFAULT_TIER = 'pro';

/**
 * Returns the full models map for a given tier.
 * Falls back to eco for unknown tiers.
 */
function getModels(tier) {
  return TIERS[tier] || TIERS[DEFAULT_TIER];
}

/**
 * Returns the model ID for a specific role at a given tier.
 * Allows opts.model override for single-model callers.
 */
function resolve(tier, role, override) {
  if (override) return override;
  const models = getModels(tier);
  return models[role] || models.codegen;
}

/**
 * Token budgets per role — tight but sufficient.
 * Use these instead of hardcoded numbers in agents.
 */
const TOKEN_BUDGETS = {
  idea:         512,   // short JSON spec
  design:      4000,   // full app design JSON
  codegen:    12000,   // one screen of code (complex screens can hit 500-700 lines)
  repair:      8000,   // patch/fix code
  taste:       1500,   // targeted edits
  conversation: 700,   // chat reply
};

/**
 * Human-readable tier descriptions for bot UI.
 */
const TIER_INFO = {
  eco:      { label: 'Eco',      emoji: '', desc: 'Gemini 3 Flash — fast, cost-efficient, solid quality.' },
  standard: { label: 'Standard', emoji: '', desc: 'Gemini 3 Flash — deeper reasoning on design and code.' },
  pro:      { label: 'Pro',      emoji: '', desc: 'Claude Sonnet 4.6 — maximum quality for design and code.' },
};

module.exports = { getModels, resolve, TOKEN_BUDGETS, TIER_INFO, TIERS, DEFAULT_TIER };
