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
    // Explicit on purpose. Left as "whatever opencode defaults to", its family cannot be
    // resolved, and the rule that no reviewer may share the implementer's family silently
    // stops being checked — in the pack most people run.
    default: { launcher: "opencode", model: "opencode/kimi-k3" },
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


/**
 * The real vendor behind a choice. `LAUNCHERS[].family` describes the CLI, which is not the
 * same thing: everything reached through OpenCode would otherwise read as one family, and
 * the whole roster would look independent while two roles ran the same model.
 */
const MODEL_FAMILIES = [
  [/^glm/, "zhipu"],
  [/^gemini/, "google"],
  [/^grok/, "xai"],
  [/^kimi/, "moonshot"],
  [/^muse/, "meta"],
  [/^(llama|codellama)/, "meta"],
  [/^deepseek/, "deepseek"],
  [/^qwen/, "qwen"],
  [/^minimax/, "minimax"],
  [/^mistral|^codestral/, "mistral"],
  [/^command/, "cohere"],
  [/^(gpt|o[0-9])/, "openai"],
  [/^claude/, "anthropic"],
];

/**
 * The real vendor behind a choice. `LAUNCHERS[].family` describes the CLI, which is not the
 * same thing: everything reached through a gateway would otherwise read as one family, and
 * a roster running two models from one vendor would look independent while it was not.
 *
 * The provider prefix is stripped before matching, so `opencode/glm-5.3` and
 * `opencode-go/glm-5.3` land on the same vendor. This table will always be incomplete —
 * which is why an unresolved family is reported, never silently skipped.
 */
export function familyOf(choice) {
  if (!choice) return null;
  if (choice.raw) return null; // a hand-written command: we cannot know, so we do not guess
  const launcher = findLauncher(choice.launcher);
  if (launcher?.kind === LAUNCHER_KINDS.terminal) {
    if (!choice.model) return "unknown";
    const name = choice.model.includes("/") ? choice.model.slice(choice.model.lastIndexOf("/") + 1) : choice.model;
    for (const [pattern, family] of MODEL_FAMILIES) {
      if (pattern.test(name)) return family;
    }
    return "unknown";
  }
  return launcher?.family ?? null;
}

const isUnknown = (f) => !f || f === "unknown";

export function checkIndependence(roles) {
  const f = (key) => familyOf(roles[key]);
  const warnings = [];
  const known = (...keys) => keys.every((k) => !isUnknown(f(k)));

  // Report what could not be checked BEFORE reporting what was. A roster that comes back
  // clean because half of it was unresolvable is the worst outcome this function can have:
  // the owner reads silence as a pass.
  const unresolved = Object.keys(roles).filter(
    (k) => k !== "reader" && roles[k] && isUnknown(f(k)),
  );
  if (unresolved.length) {
    warnings.push(
      `Cannot determine the model family for: ${unresolved.join(", ")}. The rules below were NOT checked for those roles — treat this roster as unverified, not as approved. Name an explicit model, or add the vendor to MODEL_FAMILIES in src/presets.mjs.`,
    );
  }

  if (known("plan_a", "plan_b") && f("plan_a") === f("plan_b")) {
    warnings.push(
      `Plan A and Plan B are both ${f("plan_a")}. Two planners that think alike give you one plan with extra steps, and the judge has nothing to arbitrate.`,
    );
  }
  if (known("gaps", "plan_a") && (f("gaps") === f("plan_a") || f("gaps") === f("plan_b"))) {
    warnings.push(
      `The gap hunter is ${f("gaps")}, same as a planner. Its job is to see what the planners missed, which it cannot do sharing their priors.`,
    );
  }
  if (known("judge", "plan_a") && (f("judge") === f("plan_a") || f("judge") === f("plan_b"))) {
    const side = f("judge") === f("plan_a") ? "Plan A" : "Plan B";
    warnings.push(
      `The judge is ${f("judge")}, the same family as ${side}. It is asked to arbitrate between the two plans, and it will find the one that reasons like it does more persuasive.`,
    );
  }
  const reviewers = ["review_light_1", "review_light_2", "review_deep", "review_adversarial"];
  for (const r of reviewers) {
    if (known(r, "implementer") && f(r) === f("implementer")) {
      warnings.push(
        `${r} shares the implementer's family (${f(r)}). A reviewer from the implementer's family tends to accept its assumptions.`,
      );
    }
  }
  const others = reviewers.filter((r) => r !== "review_adversarial");
  if (known("review_adversarial") && others.some((r) => known(r) && f(r) === f("review_adversarial"))) {
    warnings.push(
      `The adversarial reviewer is ${f("review_adversarial")}, already used by another reviewer. It is the only one asked to assume the rest are wrong.`,
    );
  }
  return warnings;
}

/**
 * Ready-made rosters. The axis is not really price — it is how much a mistake costs you on
 * the issues you point this at. Cheap models plan and review worse; that is fine when the
 * work is easy to undo and expensive when it is not.
 *
 * Two positions are held across all three packs. The judge is never the cheapest thing in
 * the roster, because it writes the plan that actually gets built — and it never shares a
 * family with a planner, because it would find the plan that reasons like it does more
 * persuasive. And no reviewer shares the implementer's family, because a reviewer that
 * thinks like the implementer approves the implementer.
 *
 * `orchestrator` is a recommendation, not a launcher: the orchestrator is whatever session
 * you run the skill from. The skill reads it at step 0 and says something if you are well
 * below it.
 */
export const ROSTER_PACKS = [
  {
    id: "budget",
    label: "Budget",
    hint: "small, reversible issues — high volume, cheap to be wrong",
    orchestrator: "a mid-tier model (Fable, Sonnet)",
    roles: {
      plan_a: { launcher: "claude", model: "claude-haiku-4-5", effort: "low" },
      plan_b: { launcher: "opencode", model: "opencode/glm-5.3" },
      gaps: { launcher: "opencode", model: "opencode/grok-4.6" },
      judge: { launcher: "opencode", model: "opencode/kimi-k3" },
      implementer: { launcher: "claude", model: "claude-haiku-4-5", effort: "low" },
      review_light_1: { launcher: "opencode", model: "opencode/glm-5.3" },
      review_light_2: { launcher: "opencode", model: "opencode/grok-4.6" },
      review_deep: { launcher: "opencode", model: "opencode/gemini-3.1-pro" },
      review_adversarial: { launcher: "opencode", model: "opencode/kimi-k3" },
      reader: { launcher: "claude", model: "claude-haiku-4-5", effort: "low" },
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "the default — strong planners and judge, cheap hygiene passes",
    orchestrator: "a frontier model (Opus, Fable)",
    roles: null, // falls back to each role's own `default`
  },
  {
    id: "frontier",
    label: "Frontier",
    hint: "auth, migrations, billing, tenant isolation — being wrong is expensive",
    orchestrator: "a frontier model (Opus)",
    roles: {
      plan_a: { launcher: "claude", model: "claude-opus-5", effort: "high" },
      plan_b: { launcher: "codex" },
      gaps: { launcher: "grok" },
      judge: { launcher: "opencode", model: "opencode/gemini-3.1-pro" },
      implementer: { launcher: "codex" },
      review_light_1: { launcher: "claude", model: "claude-opus-4-8" },
      review_light_2: { launcher: "opencode", model: "opencode/glm-5.3" },
      review_deep: { launcher: "claude", model: "claude-opus-5", effort: "high" },
      review_adversarial: { launcher: "opencode", model: "opencode/kimi-k3" },
      reader: { launcher: "claude", model: "claude-haiku-4-5", effort: "low" },
    },
  },
];

/** The choice a pack makes for a role, falling back to the role's own default. */
export function packChoice(pack, role) {
  return pack?.roles?.[role.key] ?? role.default;
}

export function findPack(id) {
  return ROSTER_PACKS.find((p) => p.id === id);
}

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
