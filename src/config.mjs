import { reviewSettings } from "../skill/scripts/review-batches.mjs";

/**
 * .orca-flow.yml writer. New configuration keeps explanatory comments; YAML-aware
 * migration preserves owner settings and comments in existing documents.
 */

const needsQuotes = (s) =>
  s === "" ||
  /^[\s]|[\s]$/.test(s) ||
  /^[-?:,\[\]{}#&*!|>'"%@`]/.test(s) ||
  /[:\n\r\t]/.test(s) ||
  /\s#/.test(s) ||
  /^(true|false|null|yes|no|on|off|~)$/i.test(s) ||
  /^-?\d+(\.\d+)?$/.test(s);

export function yamlString(value) {
  const s = String(value);
  if (!needsQuotes(s)) return s;
  return JSON.stringify(s);
}

function list(items, indent) {
  if (!items || items.length === 0) return " []";
  return "\n" + items.map((i) => `${indent}- ${yamlString(i)}`).join("\n");
}

export function renderConfig(cfg) {
  const L = [];
  L.push("# orca-issue-flow — project configuration");
  L.push("# https://github.com/nuoframework/orca-issue-flow");
  L.push("#");
  L.push("# The skill reads this file at the start of every run. Edit it freely: change a");
  L.push("# model, swap an agent, add a path that must trigger all specialists. Re-run");
  L.push("# `npx orca-issue-flow` to redo the wizard.");
  L.push("");
  L.push("schema_version: 2");
  L.push(`skill_directories:${list(cfg.skill_directories??[".agents/skills"], "  ")}`);
  L.push("# --- Repository -----------------------------------------------------------");
  L.push("");
  L.push("# Branch every issue worktree is cut from, and the PR base.");
  L.push(`base_branch: ${yamlString(cfg.base_branch)}`);
  L.push(`pr_base: ${yamlString(cfg.pr_base)}`);
  L.push("# Prefix for issue branches when the tracker does not supply a name.");
  L.push(`branch_prefix: ${yamlString(cfg.branch_prefix)}`);
  L.push("");
  L.push("# Files carrying the project's rules. Every worker is told to read these first.");
  L.push(`conventions_files:${list(cfg.conventions_files, "  ")}`);
  L.push("");
  L.push("# Docs the orchestrator reads for context, and checks at the end.");
  L.push(`docs_dirs:${list(cfg.docs_dirs, "  ")}`);
  L.push(`changelog: ${cfg.changelog ? yamlString(cfg.changelog) : "null"}`);
  L.push("");
  L.push("# Language for everything YOU read: the criteria, the verdict summary, the two");
  L.push("# gate questions and the final validation. It does NOT govern the code, the");
  L.push("# commit messages, the PR title and body, or code comments — those follow the");
  L.push("# repo's own convention, and a Spanish commit in an English codebase is a");
  L.push("# regression, not a feature.");
  L.push(`language: ${yamlString(cfg.language)}`);
  L.push("");
  L.push("# What you expect to be running the flow. A note to yourself, not a launcher: the");
  L.push("# orchestrator is whatever session you invoke the skill from, so no config can");
  L.push("# start it. The skill reads this at step 0 and says something once if you are");
  L.push("# driving twelve phases from a small model. `orca-issue-flow roles` never touches");
  L.push("# this line — it tells you what the new pack would suggest and leaves the choice.");
  L.push(`orchestrator: ${yamlString(cfg.orchestrator ?? "a frontier model with measured context usage")}`);
  L.push("");
  L.push("# --- Gates ----------------------------------------------------------------");
  L.push("");
  L.push("# Must be green before review, and again before the PR. Red gate = no review.");
  L.push("verify:");
  L.push(`  command: ${yamlString(cfg.verify.command)}`);
  if (cfg.verify.ui_command) {
    L.push("  # Run in addition to the above when the diff touches UI.");
    L.push(`  ui_command: ${yamlString(cfg.verify.ui_command)}`);
  } else {
    L.push("  ui_command: null");
  }
  L.push("");
  L.push("# --- Context routing ------------------------------------------------------");
  L.push("#");
  L.push("# Machine-generated output is the cheapest thing to keep out of an expensive");
  L.push("# context window: its shape is extractable, and the original never leaves");
  L.push("# .orca-run/. roles.reader does the extraction.");
  L.push("");
  L.push("context:");
  const enforcement=cfg.context.enforcement??"enforced";
  if(!["enforced","instructed"].includes(enforcement))throw new Error("Invalid context enforcement mode");
  L.push(`  enforcement: ${enforcement}`);
  L.push("  # 60% is guaranteed only with a verified enforcing runtime adapter.");
  L.push("  max_window_percent: 60");
  L.push("  handoff_at_percent: 50");
  L.push(`  require_measured_usage: ${enforcement === "enforced"}`);
  L.push("  # Runtime adapter must enforce before every model request; prompts alone cannot.");
  L.push("  max_tool_output_tokens: 4000");
  L.push("  max_packet_tokens: 12000");
  L.push("  # Digest the verify log through roles.reader above this many lines.");
  L.push("  # 0 disables line routing, but token budgets still bound every read.");
  L.push(`  digest_gate_logs_over: ${cfg.context.digest_gate_logs_over}`);
  L.push("  # Request targeted raw excerpts once the same failure has survived this");
  L.push("  # many rounds. Full logs remain on disk; context limits still apply.");
  L.push(`  raw_log_after_rounds: ${cfg.context.raw_log_after_rounds}`);
  L.push("");
  L.push("# --- Issue tracker --------------------------------------------------------");
  L.push("");
  L.push("# linear | github | none");
  L.push(`tracker: ${yamlString(cfg.tracker)}`);
  L.push(`issue_prefix: ${cfg.issue_prefix ? yamlString(cfg.issue_prefix) : "null"}`);
  L.push("");
  L.push("# --- Review policy --------------------------------------------------------");
  L.push("");
  L.push("# Legacy key: matching paths force all specialists, whatever the diff size.");
  L.push(`deep_review_paths:${list(cfg.deep_review_paths, "  ")}`);
  L.push("# ...and so does any diff bigger than this many changed lines.");
  L.push(`deep_review_lines: ${cfg.deep_review_lines}`);
  L.push("");
  L.push("# Subjects requiring an expanded adversarial threat matrix (the critic always runs).");
  L.push(`adversarial_topics:${list(cfg.adversarial_topics, "  ")}`);
  L.push("");
  L.push("# Fix rounds before the orchestrator stops and escalates to you.");
  L.push(`max_review_rounds: ${cfg.max_review_rounds}`);
  L.push("review_policy:");
  L.push("  mode: critical_specialists");
  L.push("  family_policy: native_priority");
  L.push("  adversarial: always");
  const review = reviewSettings(cfg.review_policy);
  L.push(`  execution: ${review.execution}`);
  L.push(`  max_parallel: ${review.max_parallel ?? "null"}`);
  L.push("  require_evidence: true");
  L.push("");
  L.push("# Cleanup only run-owned ephemeral resources; preserve unknown/user-kept work.");
  L.push("cleanup:");
  L.push("  enabled: true");
  L.push("  after_each_phase: true");
  L.push("  on_run_exit: true");
  L.push("  remove_volumes: false");
  L.push("");
  L.push(renderRolesSection(cfg));
  return L.join("\n");
}

/** Legacy marker retained for readable generated config; patches use YAML node ranges. */
export const ROLES_SECTION_MARKER =
  "# --- Roles ----------------------------------------------------------------";

/**
 * Generate the roles mapping. The patcher preserves surrounding bytes even when owners
 * append more top-level settings after this mapping.
 */
export function renderRolesSection(cfg) {
  const L = [];
  L.push(ROLES_SECTION_MARKER);
  L.push("#");
  L.push("# `launch` is the command the orchestrator runs; it appends --task/--worktree/--json.");
  L.push("# Three ordered choices: launch, fallback, fallback_2; preflight each before use.");
  L.push("# What matters is that the roles stay independent: two planners that think alike");
  L.push("# produce one plan, and model diversity reduces correlated assumptions; evidence still decides.");
  L.push("#");
  L.push("# Re-pick this roster any time with `npx orca-issue-flow roles`. It rewrites this");
  L.push("# section only and leaves everything above untouched.");
  L.push("");
  L.push("roles:");
  for (const role of cfg.roles) {
    L.push(`  ${role.key}:`);
    L.push(`    label: ${yamlString(role.label)}`);
    L.push(`    launch: ${yamlString(role.launch)}`);
    L.push(`    fallback: ${role.fallback ? yamlString(role.fallback) : "null"}`);
    L.push(`    fallback_2: ${role.fallback_2 ? yamlString(role.fallback_2) : "null"}`);
  }
  L.push("");
  return L.join("\n");
}
