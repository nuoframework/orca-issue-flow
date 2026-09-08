/**
 * Catalogue of ways to launch a worker in Orca, and which ones make sense per role.
 *
 * A "launcher" is just the command fragment the orchestrator pastes. The flow does not
 * care which model sits behind a role — it cares that the roles are independent from
 * each other. Everything here is a default you can override in the wizard or by editing
 * .orca-flow.yml afterwards.
 */

/** Orca launches a worker either through `worker-start` or through a plain terminal. */
export const LAUNCHER_KINDS = {
  worker: "worker-start",
  terminal: "terminal",
};

/**
 * `id` is stable and used in .orca-flow.yml. `launch` is what ends up in the config.
 * `family` is what the flow uses to keep reviewers from sharing the planners' blind spots.
 */
export const LAUNCHERS = [
  {
    id: "claude",
    label: "Claude Code (worker-start --agent claude)",
    family: "anthropic",
    kind: LAUNCHER_KINDS.worker,
    /** Models offered for this launcher. Free text is always allowed too. */
    models: [
      "claude-fable-5-1",
      "claude-opus-5",
      "claude-opus-4-8",
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ],
    supportsEffort: true,
    build: ({ model, effort }) =>
      [
        "orca orchestration worker-start --agent claude",
        model ? `--model ${model}` : "",
        effort ? `--effort ${effort}` : "",
      ]
        .filter(Boolean)
        .join(" "),
  },
  {
    id: "codex",
    label: "Codex (worker-start --agent codex)",
    family: "openai",
    kind: LAUNCHER_KINDS.worker,
    models: [],
    supportsEffort: false,
    build: () => "orca orchestration worker-start --agent codex",
  },
  {
    id: "grok",
    label: "Grok (worker-start --agent grok)",
    family: "xai",
    kind: LAUNCHER_KINDS.worker,
    models: [],
    supportsEffort: false,
    build: () => "orca orchestration worker-start --agent grok",
  },
  {
    id: "opencode",
    label: "OpenCode (terminal, any model it exposes)",
    family: "opencode",
    kind: LAUNCHER_KINDS.terminal,
    models: [
      "",
      "opencode/grok-4.6",
      "opencode/glm-5.3",
      "opencode/gemini-3.1-pro",
      "opencode/kimi-k3",
    ],
    supportsEffort: false,
    build: ({ model, agent }) => {
      const parts = ["opencode"];
      if (agent) parts.push(`--agent ${agent}`);
      if (model) parts.push(`--model ${model}`);
      return `orca terminal create --command "${parts.join(" ")}"`;
    },
  },
];

export const EFFORTS = ["low", "medium", "high"];

/**
 * The nine roles of the panel, plus the service roles that support them. `why` is shown
 * in the wizard so people can make a real choice instead of accepting defaults they do
 * not understand.
 *
 * A role marked `service: true` is not a panelist: it has no opinion, it does not judge
 * the code, and nothing downstream depends on its taste. That is why it can share a model
 * family with anyone without costing the flow its independence.
 */
export const ROLES = [
  {
    key: "plan_a",
    label: "Plan A",
    why: "Writes an independent implementation plan. Never sees plan B.",
    phase: 2,
    default: { launcher: "claude", model: "claude-fable-5-1", effort: "medium" },
    fallback: { launcher: "claude", model: "claude-opus-4-8" },
  },
  {
    key: "plan_b",
    label: "Plan B",
    why: "The second, independent plan. Pick a different family from Plan A — two correlated plans are worth one.",
    phase: 2,
    default: { launcher: "codex" },
    fallback: { launcher: "claude", model: "claude-opus-4-8" },
  },
  {
    key: "gaps",
    label: "Gap hunter",
    why: "Reads both plans and only reports what neither considered. Proposes nothing.",
    phase: 3,
    default: { launcher: "grok" },
    fallback: { launcher: "opencode", model: "opencode/grok-4.6" },
  },
  {
    key: "judge",
    label: "Judge",
    why: "Merges A, B and the gaps into one self-sufficient final plan. This is what gets built.",
    phase: 4,
    default: { launcher: "opencode", model: "opencode/glm-5.3" },
    fallback: { launcher: "claude", model: "claude-opus-5" },
  },
  {
    key: "implementer",
    label: "Implementer",
    why: "The only worker allowed to touch product files. Follows the approved plan literally.",
    phase: 6,
    default: { launcher: "opencode" },
    fallback: { launcher: "claude", model: "claude-fable-5-1", effort: "medium" },
  },
  {
    key: "review_light_1",
    label: "Light review 1",
    why: "Cheap pass: naming, duplication, dead code, debug leftovers, stray diff.",
    phase: 8,
    default: { launcher: "claude", model: "claude-fable-5-1", effort: "low" },
    fallback: null,
  },
  {
    key: "review_light_2",
    label: "Light review 2",
    why: "Second cheap pass from another model: consistency, docs, changelog, sanity check.",
    phase: 8,
    default: { launcher: "claude", model: "claude-opus-4-8" },
    fallback: null,
  },
  {
    key: "review_deep",
    label: "Deep review",
    why: "Runs on risky diffs: security, correctness, edge cases, concurrency, test quality.",
    phase: 8,
    default: { launcher: "claude", model: "claude-fable-5-1", effort: "medium" },
    fallback: null,
  },
  {
    key: "review_adversarial",
    label: "Adversarial review",
    why: "Auth, crypto, payments, migrations. Must be a family none of the other reviewers used.",
    phase: 8,
    default: { launcher: "opencode", model: "opencode/gemini-3.1-pro" },
    fallback: { launcher: "opencode", model: "opencode/glm-5.3" },
  },
  {
    key: "reader",
    label: "Reader",
    why: "Turns machine output — verify logs above all — into something worth a context window. Extracts, never diagnoses.",
    service: true,
    default: { launcher: "claude", model: "claude-haiku-4-5", effort: "low" },
    fallback: { launcher: "claude", model: "claude-fable-5-1", effort: "low" },
  },
];

/** The nine that carry an opinion. The wizard introduces these as the panel. */
export const PHASE_ROLES = ROLES.filter((r) => !r.service);

/** Support roles the orchestrator calls on demand rather than at a fixed phase. */
export const SERVICE_ROLES = ROLES.filter((r) => r.service);

/** Paths whose diffs should always get the deep review. Suggested per ecosystem. */
export const DEEP_REVIEW_SUGGESTIONS = [
  "auth*",
  "**/middleware.*",
  "**/*guard*",
  "**/migrations/**",
  "**/schema.prisma",
  "**/crypto*",
];

export const ADVERSARIAL_TOPIC_SUGGESTIONS = [
  "authentication",
  "authorization and permissions",
  "cryptography and secrets",
  "payments, billing or licensing",
  "database migrations",
  "multi-tenant isolation",
];

export function findLauncher(id) {
  return LAUNCHERS.find((l) => l.id === id);
}

/** Turn a `{launcher, model, effort, agent}` choice into the command string stored in YAML. */
export function buildLaunch(choice) {
  if (!choice) return null;
  if (choice.raw) return choice.raw;
  const launcher = findLauncher(choice.launcher);
  if (!launcher) return null;
  return launcher.build(choice);
}
