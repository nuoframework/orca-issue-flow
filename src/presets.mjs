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
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
      "claude-fable-5-1",
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
    models: ["gpt-6.1-terra", "gpt-6.1-sol", "gpt-6-astra", "gpt-6-sol", "gpt-6-luna"],
    supportsEffort: true,
    build: ({ model, effort }) => ["orca orchestration worker-start --agent codex",
      model ? `--model ${model}` : "", model && effort ? `--effort ${effort}` : ""].filter(Boolean).join(" "),
  },
  {
    id: "grok",
    label: "Grok (worker-start --agent grok)",
    family: "xai",
    kind: LAUNCHER_KINDS.worker,
    models: ["grok-4.6", "grok-4.5"],
    supportsEffort: true,
    build: ({ model, effort }) => ["orca orchestration worker-start --agent grok",
      model ? `--model ${model}` : "", model && effort ? `--effort ${effort}` : ""].filter(Boolean).join(" "),
  },
  {
    id: "opencode",
    label: "OpenCode (supervised worker, verified model catalog)",
    family: "opencode",
    kind: LAUNCHER_KINDS.worker,
    models: ["opencode/claude-opus-5-5", "opencode/claude-sonnet-5-5",
      "opencode/claude-haiku-5-5", "opencode/gpt-6.1-sol", "opencode/gpt-6-astra",
      "opencode/gemini-4-argon", "opencode-go/kimi-k3.1-pro", "opencode/kimi-k3", "opencode/glm-5.3", "opencode/glm-5.3-flash",
      "opencode/gemini-3.1-pro", "opencode/gemini-3.8-flash", "opencode/grok-4.7",
      "opencode/gpt-6-sol", "opencode/gpt-6-luna", "opencode/deepseek-v4.1-flash"],
    supportsEffort: false,
    build: ({ model }) => ["orca orchestration worker-start --agent opencode",
      model ? `--model ${model}` : ""].filter(Boolean).join(" "),
  },
];

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

/**
 * The workflow roles of the panel, plus the service roles that support them. `why` is shown
 * in the wizard so people can make a real choice instead of accepting defaults they do
 * not understand.
 *
 * A role marked `service: true` is not a panelist: it has no opinion, it does not judge
 * the code, and nothing downstream depends on its taste. That is why it can share a model
 * family with anyone without costing the flow its independence.
 */
export const ROLES = [
  {
    key: "plan_a", label: "Plan A",
    why: "Independent plan; never reads Plan B.", phase: 2,
    default: { launcher: "claude", model: "claude-sonnet-5-5", effort: "medium" },
    fallback: { launcher: "claude", model: "claude-opus-5-5", effort: "medium" },
    fallback_2: { launcher: "claude", model: "claude-haiku-5-5", effort: "medium" },
  },
  {
    key: "plan_b", label: "Plan B",
    why: "Independent plan from a different provider; never reads Plan A.", phase: 2,
    default: { launcher: "codex", model: "gpt-6.1-terra", effort: "medium" },
    fallback: { launcher: "codex", model: "gpt-6.1-sol", effort: "medium" },
    fallback_2: { launcher: "codex", model: "gpt-6-sol", effort: "medium" },
  },
  {
    key: "gaps", label: "Gap hunter",
    why: "Evidence-backed omissions in both plans; does not invent another plan.", phase: 3,
    default: { launcher: "claude", model: "claude-sonnet-5-5", effort: "medium" },
    fallback: { launcher: "claude", model: "claude-opus-5-5", effort: "medium" },
    fallback_2: { launcher: "codex", model: "gpt-6.1-terra", effort: "medium" },
  },
  {
    key: "judge", label: "Judge",
    why: "Strong synthesis and explicit risk decisions; no product edits.", phase: 4,
    default: { launcher: "claude", model: "claude-opus-5-5", effort: "medium" },
    fallback: { launcher: "claude", model: "claude-sonnet-5-5", effort: "medium" },
    fallback_2: { launcher: "codex", model: "gpt-6.1-sol", effort: "medium" },
  },
  {
    key: "implementer", label: "Implementer",
    why: "Only product writer; follows the approved plan and creates checkpoints.", phase: 6,
    default: { launcher: "codex", model: "gpt-6.1-terra", effort: "medium" },
    fallback: { launcher: "opencode", model: "opencode/deepseek-v4.1-flash" },
    fallback_2: { launcher: "codex", model: "gpt-6.1-sol", effort: "medium" },
  },
  {
    key: "review_ui", label: "UI/UX critic",
    why: "Accessibility, states, interaction, responsive layout; requires UI evidence.", phase: 8,
    default: { launcher: "claude", model: "claude-haiku-5-5", effort: "low" },
    fallback: { launcher: "claude", model: "claude-sonnet-5-5", effort: "low" },
    fallback_2: { launcher: "claude", model: "claude-opus-5-5", effort: "low" },
  },
  {
    key: "review_performance", label: "Stability and performance critic",
    why: "Failure recovery, resource bounds, concurrency and measured performance.", phase: 8,
    default: { launcher: "codex", model: "gpt-6.1-sol", effort: "medium" },
    fallback: { launcher: "codex", model: "gpt-6.1-terra", effort: "medium" },
    fallback_2: { launcher: "codex", model: "gpt-6-sol", effort: "medium" },
  },
  {
    key: "review_architecture", label: "Architecture critic",
    why: "Boundaries, coupling, compatibility, migrations and unnecessary complexity.", phase: 8,
    default: { launcher: "claude", model: "claude-sonnet-5-5", effort: "medium" },
    fallback: { launcher: "claude", model: "claude-opus-5-5", effort: "medium" },
    fallback_2: { launcher: "claude", model: "claude-haiku-5-5", effort: "medium" },
  },
  {
    key: "review_security", label: "Security critic",
    why: "Trust boundaries, authorization, tenant isolation, secrets and injection.", phase: 8,
    default: { launcher: "claude", model: "claude-opus-5-5", effort: "medium" },
    fallback: { launcher: "claude", model: "claude-sonnet-5-5", effort: "medium" },
    fallback_2: { launcher: "claude", model: "claude-haiku-5-5", effort: "medium" },
  },
  {
    key: "review_docs", label: "Documentation critic",
    why: "Public behavior, configuration, examples, migration notes and changelog.", phase: 8,
    default: { launcher: "claude", model: "claude-haiku-5-5", effort: "low" },
    fallback: { launcher: "claude", model: "claude-sonnet-5-5", effort: "low" },
    fallback_2: { launcher: "opencode", model: "opencode/gemini-3.8-flash" },
  },
  {
    key: "review_tests", label: "Test critic",
    why: "Missing regression cases, false-positive tests, negative cases and flaky tests.", phase: 8,
    default: { launcher: "codex", model: "gpt-6.1-sol", effort: "medium" },
    fallback: { launcher: "codex", model: "gpt-6.1-terra", effort: "medium" },
    fallback_2: { launcher: "codex", model: "gpt-6-sol", effort: "medium" },
  },
  {
    key: "review_qa", label: "QA critic",
    why: "Execute acceptance and negative scenarios; prove observed behavior.", phase: 8,
    default: { launcher: "claude", model: "claude-haiku-5-5", effort: "low" },
    fallback: { launcher: "codex", model: "gpt-6-luna", effort: "low" },
    fallback_2: { launcher: "codex", model: "gpt-6.1-terra", effort: "low" },
  },
  {
    key: "review_final", label: "Review adjudicator",
    why: "Validate findings, resolve contradictions; cannot silently dismiss evidence.", phase: 8,
    default: { launcher: "claude", model: "claude-sonnet-5-5", effort: "medium" },
    fallback: { launcher: "claude", model: "claude-opus-5-5", effort: "medium" },
    fallback_2: { launcher: "claude", model: "claude-haiku-5-5", effort: "medium" },
  },
  {
    key: "review_adversarial", label: "Adversarial critic",
    why: "Always runs last, independently attacks the code before reading other reports.", phase: 8,
    default: { launcher: "claude", model: "claude-sonnet-5-5", effort: "medium" },
    fallback: { launcher: "codex", model: "gpt-6.1-sol", effort: "medium" },
    fallback_2: { launcher: "grok", model: "grok-4.6", effort: "medium" },
  },
  {
    key: "reader", label: "Reader",
    why: "Extract large logs verbatim with source line ranges; no diagnosis.", phase: 7,
    default: { launcher: "codex", model: "gpt-6-luna", effort: "low" },
    fallback: { launcher: "claude", model: "claude-haiku-5-5", effort: "low" },
    fallback_2: { launcher: "opencode", model: "opencode/glm-5.3-flash" },
    service: true,
  },
  {
    key: "janitor", label: "Environment janitor",
    why: "Reconcile run-owned temporary resources; clean proven leftovers, preserve other work.",
    service: true,
    default: { launcher: "claude", model: "claude-haiku-5-5", effort: "low" },
    fallback: { launcher: "codex", model: "gpt-6-luna", effort: "low" },
    fallback_2: { launcher: "opencode", model: "opencode/glm-5.3-flash" },
  },
];

export const PHASE_ROLES = ROLES.filter((r) => !r.service);
export const SERVICE_ROLES = ROLES.filter((r) => r.service);

/** Paths whose diffs should always get all specialist critics. Suggested per ecosystem. */
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
/** Read known supervised launch fragments without executing shell text. */
export function choiceFromLaunch(command) {
  if(typeof command!=="string"||/[;&|$<>`\n\r]/.test(command))return null;
  const raw=(command.match(/"[^"]*"|'[^']*'|[^\s]+/g)??[]).map(v=>v.replace(/^("|')(.*)\1$/,"$2"));
  const tokens=raw.flatMap(t=>t.startsWith("--")&&t.includes("=")?[t.slice(0,t.indexOf("=")),t.slice(t.indexOf("=")+1)]:[t]);
  for(const flag of ["--agent","--model","--effort"])if(tokens.filter(t=>t===flag).length>1)return null;
  if(tokens.slice(0,3).join(" ")!=="orca orchestration worker-start")return null;
  const read=flag=>{const i=tokens.indexOf(flag);return i<0?undefined:tokens[i+1];};
  const launcher=read("--agent"),model=read("--model"),effort=read("--effort");
  if(!findLauncher(launcher)||!model||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(model))return null;
  return {launcher,model,...(effort?{effort}:{})};
}

export function familyOf(choice) {
  if (!choice) return null;
  if (choice.raw) return null; // a hand-written command: we cannot know, so we do not guess
  const launcher = findLauncher(choice.launcher);
  if (choice.launcher === "opencode" || launcher?.kind === LAUNCHER_KINDS.terminal) {
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
    (k) => !ROLES.find(role => role.key === k)?.service && roles[k] && isUnknown(f(k)),
  );
  if (unresolved.length) {
    warnings.push(
      `Cannot determine the model family for: ${unresolved.join(", ")}. The rules below were NOT checked for those roles — treat this roster as unverified, not as approved. Name an explicit model, or add the vendor to MODEL_FAMILIES in src/presets.mjs.`,
    );
  }

  if (known("plan_a", "plan_b") && f("plan_a") === f("plan_b")) {
    warnings.push(
      `Plan A and Plan B are both ${f("plan_a")}. Use different families to reduce correlated planning assumptions.`,
    );
  }
  // The owner prioritizes native Claude/Codex. Treat family overlap in specialist
  // roles as correlation to document, not as automatic disqualification. Keep two
  // independent closure gates opposite the actual implementer.
  for (const r of ["review_security", "review_final"]) {
    if (known(r, "implementer") && f(r) === f("implementer")) {
      warnings.push(`${r} shares the implementer's family (${f(r)}). Security and final adjudication require another family.`);
    }
  }
  return warnings;
}

/** Non-blocking correlation notes: enforce blind sessions and evidence, not vendor count. */
export function correlationNotes(roles) {
  const family = key => familyOf(roles[key]);
  const same = (a, b) => roles[a] && roles[b] && !isUnknown(family(a)) && family(a) === family(b);
  const notes = [];
  if (same("judge", "plan_a") || same("judge", "plan_b")) notes.push("Judge shares a planner family: anonymize plan authors and compare claims against evidence.");
  if (same("gaps", "plan_a") || same("gaps", "plan_b")) notes.push("Gap hunter shares a planner family: use a fresh session and require independently traced omissions.");
  for (const key of Object.keys(roles).filter(k => k.startsWith("review_"))) {
    if (same(key, "implementer")) notes.push(`${key} shares the implementer family: fresh session, blind initial report and reproducible counterexamples required.`);
  }
  if (Object.keys(roles).some(k => k.startsWith("review_") && k !== "review_adversarial" && same(k, "review_adversarial"))) notes.push("Adversarial critic shares another critic's family: record the exception and preserve its independent initial attack before reading reports.");
  return notes;
}

/**
 * Ready-made rosters. The axis is not really price — it is how much a mistake costs you on
 * the issues you point this at. Cheap models plan and review worse; that is fine when the
 * work is easy to undo and expensive when it is not.
 *
 * Two positions are held across all three packs. The judge is never the cheapest thing in
 * the roster, because it writes the plan that actually gets built. Native-priority mode permits planner-family
 * overlap and records it;
 * security and final adjudication must remain opposite the implementer.
 *
 * `orchestrator` is a recommendation, not a launcher: the orchestrator is whatever session
 * you run the skill from. The skill reads it at step 0 and says something if you are well
 * below it.
 */
export const ROSTER_PACKS = [
  {
    id: "budget", label: "Budget",
    hint: "low-effort Terra for small reversible work; critical reviewers unchanged",
    orchestrator: "a frontier model with measured context usage",
    roles: {
      plan_b: { launcher: "codex", model: "gpt-6.1-terra", effort: "low" },
      implementer: { launcher: "codex", model: "gpt-6.1-terra", effort: "low" },
    },
  },
  {
    id: "balanced", label: "Balanced",
    hint: "Cost-aware native roster; Terra implementation; OpenCode economy reserve",
    orchestrator: "a frontier model with measured context usage",
    roles: null,
  },
  {
    id: "frontier", label: "Frontier",
    hint: "expensive mistakes; stronger planning and implementation",
    orchestrator: "a frontier model with measured context usage",
    roles: {
      plan_b: { launcher: "codex", model: "gpt-6.1-sol", effort: "medium" },
      implementer: { launcher: "codex", model: "gpt-6.1-sol", effort: "medium" },
      review_docs: { launcher: "claude", model: "claude-opus-5-5", effort: "medium" },
    },
  },
];

/** The choice a pack makes for a role, falling back to the role's own default. */
export function packChoice(pack, role) {
  return pack?.roles?.[role.key] ?? role.default;
}

/** Three ordered, distinct model/launcher choices. Custom primary remains first. */
export function roleChoices(role, primary = role.default) {
  const result = [];
  const seen = new Set();
  // Effort changes alone are not another availability option.
  for (const choice of [primary, role.default, role.fallback, role.fallback_2]) {
    if (!choice) continue;
    const id = choice.raw ?? `${choice.launcher}:${choice.model ?? ""}`;
    if (!seen.has(id)) { seen.add(id); result.push(choice); }
    if (result.length === 3) break;
  }
  return result;
}

/** Verify all generated reserves against the primary roster, not just the primaries. */
export function resolveRoster(chosen) {
  const problems=checkIndependence(chosen);
  if(problems.length)throw new Error(problems.join("\n"));
  const result={};
  for(const role of ROLES) {
    const primary=chosen[role.key]??role.default;
    const pool=[primary,role.default,role.fallback,role.fallback_2,
      ...ROLES.flatMap(r=>[r.default,r.fallback,r.fallback_2]),
      ...LAUNCHERS.flatMap(l=>l.models.map(model=>({launcher:l.id,model,...(l.supportsEffort?{effort:primary.effort??role.default.effort??"medium"}:{})})))];
    const seen=new Set();result[role.key]=[];
    for(const candidate of pool) {
      if(!candidate)continue;
      const id=candidate.raw??`${candidate.launcher}:${candidate.model??""}`;
      if(seen.has(id)||checkIndependence({...chosen,[role.key]:candidate}).length)continue;
      seen.add(id);result[role.key].push(candidate);
      if(result[role.key].length===3)break;
    }
    if(result[role.key].length!==3)throw new Error(`Cannot build three compatible choices for ${role.key}; select a supported explicit model.`);
  }
  return result;
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
