import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import c from "picocolors";

import { renderConfig } from "./config.mjs";
import * as detect from "./detect.mjs";
import {positiveIntegerOrDefault} from "./validation.mjs";
import {writeRoles} from "./roles-file.mjs";
import {skillTargets} from "./upgrade.mjs";
import {contextMode, readConfig} from "./project-config.mjs";
import {
  ADVERSARIAL_TOPIC_SUGGESTIONS,
  DEEP_REVIEW_SUGGESTIONS,
  EFFORTS,
  LAUNCHER_KINDS,
  LAUNCHERS,
  PHASE_ROLES,
  ROLES,
  ROSTER_PACKS,
  SERVICE_ROLES,
  buildLaunch,
  checkIndependence,
  correlationNotes,
  familyOf,
  findLauncher,
  findPack,
  packChoice,
  resolveRoster,
} from "./presets.mjs";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_NAME = ".orca-flow.yml";
const SKILL_NAME = "orca-issue-flow";

/** Every prompt goes through this so Ctrl-C leaves the repo untouched. */
function guard(value) {
  if (p.isCancel(value)) {
    p.cancel("Nothing was written.");
    process.exit(130);
  }
  return value;
}

const splitList = (s) =>
  String(s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export async function init(options = {}) {
  console.log("");
  p.intro(`${c.bgYellow(c.black(" orca-issue-flow "))} ${c.dim("multi-agent issue workflow for Orca")}`);

  const root = detect.repoRoot() ?? process.cwd();
  if (!detect.repoRoot()) {
    p.log.warn(`Not inside a git repository. Installing into ${c.cyan(root)} anyway.`);
  }
  p.log.info(`Repository: ${c.cyan(root)}`);
  if (!detect.hasOrcaCli()) {
    p.log.warn("The `orca` CLI is not on PATH. The skill needs it at run time, not now.");
  }

  // ---------------------------------------------------------------- skill location
  const { existing, known } = detect.detectSkillDirs(root);
  const skillDirChoices = (existing.length ? existing : known).map((k) => ({
    value: k.path,
    label: k.label,
  }));
  if (existing.length && existing.length < known.length) {
    for (const k of known) {
      if (!existing.some((e) => e.path === k.path)) {
        skillDirChoices.push({ value: k.path, label: k.label + c.dim("  (create)") });
      }
    }
  }
  const skillsDir = guard(
    await p.select({
      message: "Where should the skill be installed?",
      options: [...skillDirChoices, { value: "__custom__", label: "Somewhere else…" }],
      initialValue: skillDirChoices[0]?.value,
    }),
  );
  const skillsPath =
    skillsDir === "__custom__"
      ? guard(
          await p.text({
            message: "Skills directory, relative to the repo root",
            placeholder: ".agents/skills",
            defaultValue: ".agents/skills",
          }),
        )
      : skillsDir;

  // ---------------------------------------------------------------- repository shape
  const baseBranch = guard(
    await p.text({
      message: "Which branch does every issue branch off?",
      placeholder: detect.detectBaseBranch(root),
      defaultValue: detect.detectBaseBranch(root),
      // Clack validates before applying defaultValue, so empty means "take the default".
      validate: (v) => (!v || v.includes("/") ? undefined : "Use a remote ref, e.g. origin/main"),
    }),
  );
  const prBase = baseBranch.replace(/^[^/]+\//, "");

  const branchPrefix = guard(
    await p.text({
      message: "Prefix for issue branches",
      placeholder: detect.detectBranchPrefix(root),
      defaultValue: detect.detectBranchPrefix(root),
    }),
  );

  // ---------------------------------------------------------------- gates
  const detectedVerify = detect.detectVerifyCommand(root);
  const verifyCommand = guard(
    await p.text({
      message: "Command that must be green before review and before the PR",
      placeholder: detectedVerify ?? "npm test",
      defaultValue: detectedVerify ?? "npm test",
      validate: (v) =>
        v === "" || v?.trim() ? undefined : "The flow refuses to review a red gate — give it a command",
    }),
  );
  const wantsUiCommand = guard(
    await p.confirm({
      message: "Is there a heavier command for UI changes (e2e, visual)?",
      initialValue: false,
    }),
  );
  const uiCommand = wantsUiCommand
    ? guard(
        await p.text({
          message: "UI verification command",
          placeholder: "npm run test:e2e",
        }),
      )
    : null;

  // ---------------------------------------------------------------- tracker
  const detectedTracker = detect.detectTracker(root);
  const tracker = guard(
    await p.select({
      message: "Which issue tracker do you work from?",
      initialValue: detectedTracker,
      options: [
        { value: "linear", label: "Linear", hint: "orca linear …, branch names come from the issue" },
        { value: "github", label: "GitHub Issues", hint: "gh issue view / comment" },
        { value: "none", label: "None", hint: "you paste the brief into the chat" },
      ],
    }),
  );
  let issuePrefix = null;
  if (tracker !== "none") {
    const detected = detect.detectIssuePrefix(root);
    issuePrefix = guard(
      await p.text({
        message: "Issue key prefix",
        placeholder: detected ?? "ABC",
        defaultValue: detected ?? "",
      }),
    );
    issuePrefix = issuePrefix.trim() || null;
  }

  // ---------------------------------------------------------------- context files
  const detectedConventions = detect.detectConventionFiles(root);
  const conventionsFiles = detectedConventions.length
    ? guard(
        await p.multiselect({
          message: "Which files carry the rules every worker must read first?",
          options: detectedConventions.map((f) => ({ value: f, label: f })),
          initialValues: detectedConventions.filter((f) => f === "AGENTS.md" || f === "CLAUDE.md"),
          required: false,
        }),
      )
    : splitList(
        guard(
          await p.text({
            message: "Files carrying the project rules (comma separated, blank for none)",
            placeholder: "AGENTS.md, CONTRIBUTING.md",
            defaultValue: "",
          }),
        ),
      );

  const language = guard(
    await p.text({
      message: "Language for what you read — criteria, verdict, gate questions, validation",
      placeholder: "English",
      defaultValue: "English",
    }),
  );

  // ---------------------------------------------------------------- review policy
  const deepPaths = splitList(
    guard(
      await p.text({
        message: "Paths that always require all specialist critics (comma separated)",
        placeholder: DEEP_REVIEW_SUGGESTIONS.join(", "),
        defaultValue: DEEP_REVIEW_SUGGESTIONS.join(", "),
      }),
    ),
  );
  const deepLines = Number(
    guard(
      await p.text({
        message: "…and any diff larger than how many changed lines?",
        placeholder: "300",
        defaultValue: "300",
        validate: (v) => (!v || (Number.isFinite(Number(v)) && Number(v) > 0) ? undefined : "A positive number"),
      }),
    ),
  );
  const adversarialTopics = guard(
    await p.multiselect({
      message: "Subjects requiring expanded adversarial analysis",
      options: ADVERSARIAL_TOPIC_SUGGESTIONS.map((t) => ({ value: t, label: t })),
      initialValues: ADVERSARIAL_TOPIC_SUGGESTIONS.slice(0, 5),
      required: false,
    }),
  );
  const maxRounds = Number(
    guard(
      await p.text({
        message: "Fix rounds before the orchestrator escalates to you",
        placeholder: "3",
        defaultValue: "3",
        validate: (v) =>
          !v || (Number.isInteger(Number(v)) && Number(v) > 0) ? undefined : "A positive whole number",
      }),
    ),
  );

  const reviewExecution = guard(await p.select({
    message: "How should specialist reviews run?",
    initialValue: "batched",
    options: [
      { value: "sequential", label: "One after another", hint: "lowest simultaneous resource use" },
      { value: "batched", label: "Limited parallel batches", hint: "default: up to 3 specialists" },
      { value: "parallel", label: "All specialists at once", hint: "fastest wall-clock, highest concurrency" },
    ],
  }));
  const reviewParallel = reviewExecution === "batched" ? Number(guard(await p.text({
    message: "Maximum simultaneous specialist reviewers",
    placeholder: "3",
    defaultValue: "3",
    validate: positiveIntegerOrDefault,
  }))) : reviewExecution === "sequential" ? 1 : null;

  const enforcement = contextMode(options.enforcement ?? guard(await p.select({
    message: "How should the 60% context target be applied?",
    initialValue: "enforced",
    options: [
      {value:"enforced", label:"Strict enforcement", hint:"requires a pre-request adapter; unsupported runtimes stop"},
      {value:"instructed", label:"Instructed target only", hint:"explicit opt-in; NOT a guaranteed 60% limit"},
    ],
  })));
  if(enforcement === "instructed")p.log.warn("The 60% limit will NOT be guaranteed. Both owner gates and delivery must disclose this mode.");

  // ---------------------------------------------------------------- roles
  p.log.step(c.bold("Roles"));
  p.log.message(
    c.dim(
      "Specialist roles run the flow. The defaults below are a working roster; what actually\n" +
        "matters is that the two planners, the gap hunter and the reviewers do not all come\n" +
        "from the same model family.",
    ),
  );
  for (const role of PHASE_ROLES) {
    p.log.message(`${c.yellow("•")} ${c.bold(role.label)} ${c.dim("— " + role.why)}`);
  }
  p.log.message(
    c.dim(
      "\nPlus service roles that have no opinion and never judge the code:",
    ),
  );
  for (const role of SERVICE_ROLES) {
    p.log.message(`${c.dim("•")} ${c.bold(role.label)} ${c.dim("— " + role.why)}`);
  }

  const { roles, orchestrator } = await chooseRoster();

  // ---------------------------------------------------------------- write
  const cfg = {
    base_branch: baseBranch,
    pr_base: prBase,
    branch_prefix: branchPrefix,
    conventions_files: conventionsFiles,
    docs_dirs: detect.detectDocsDirs(root),
    changelog: detect.detectChangelog(root),
    language: language.trim() || "English",
    orchestrator,
    verify: { command: verifyCommand, ui_command: uiCommand },
    context: { enforcement, digest_gate_logs_over: 200, raw_log_after_rounds: 2 },
    tracker,
    issue_prefix: issuePrefix,
    deep_review_paths: deepPaths,
    deep_review_lines: deepLines,
    adversarial_topics: adversarialTopics,
    max_review_rounds: maxRounds,
    review_policy: { execution: reviewExecution, max_parallel: reviewParallel },
    roles,
    skill_directories: [skillsPath],
  };

  const configPath = join(root, CONFIG_NAME);
  if (existsSync(configPath) && !options.force) {
    const overwrite = guard(
      await p.confirm({ message: `${CONFIG_NAME} already exists. Overwrite it?`, initialValue: false }),
    );
    if (!overwrite) {
      p.cancel("Left the existing config alone. Nothing was written.");
      process.exit(0);
    }
  }

  const spinner = p.spinner();
  spinner.start("Writing files");
  const result = applyInstall(root, cfg, skillsPath);
  spinner.stop("Files written");

  const written = [
    `${c.green("+")} ${CONFIG_NAME}`,
    `${c.green("+")} ${relative(root, result.skillTarget)}/SKILL.md`,
    `${c.green("+")} ${relative(root, result.skillTarget)}/references/`,
  ];
  if (result.ignoreAdded) written.push(`${c.green("+")} .gitignore  ${c.dim("(.orca-run/)")}`);
  p.note(written.join("\n"), "Installed");

  // A repo that ignores `.agents/` or `.claude/` swallows the skill without a word:
  // the install succeeds, the file is on disk, and it never reaches a commit.
  if (detect.isIgnoredByGit(root, result.skillTarget)) {
    p.log.warn(
      `${c.yellow(relative(root, result.skillTarget))} is ignored by git.\n` +
        "The skill is on disk but nobody can commit it, so your teammates will not get\n" +
        "it and a fresh clone will not have it. Add an exception to .gitignore:\n" +
        c.cyan(`  !${relative(root, result.skillTarget)}/`),
    );
  }

  const example = issuePrefix ? `${issuePrefix}-123` : "ABC-123";
  p.note(
    [
      `${c.bold("1.")} Read ${c.cyan(CONFIG_NAME)} and adjust anything the wizard guessed.`,
      `${c.bold("2.")} Open a session in your main checkout and say:`,
      `   ${c.yellow(`run issue ${example}`)}   ${c.dim("or")}   ${c.yellow(`$${SKILL_NAME} ${example}`)}`,
      `${c.bold("3.")} The orchestrator stops twice and waits for you: once on the plan,`,
      `   once before it pushes. Nothing reaches GitHub before that second OK.`,
    ].join("\n"),
    "Next",
  );

  p.outro(`${c.dim("Docs:")} https://github.com/nuoframework/orca-issue-flow`);
}

/**
 * Everything the wizard writes to disk, in one place so it can be exercised without a TTY.
 * Returns where the skill landed and whether .gitignore had to be touched.
 */
export function applyInstall(root, cfg, skillsPath, skillName = SKILL_NAME) {
  const rendered=renderConfig({...cfg,skill_directories:cfg.skill_directories??[skillsPath]});
  writeFileSync(join(root, CONFIG_NAME), rendered, "utf8");

  const skillTarget = join(root, skillsPath, skillName);
  mkdirSync(dirname(skillTarget), { recursive: true });
  cpSync(join(PKG_ROOT, "skill"), skillTarget, { recursive: true });

  return { skillTarget, ignoreAdded: ensureGitignore(root, ".orca-run/") };
}



/**
 * Re-pick the roster on an installed project without disturbing anything else. The roles
 * section is always last and always rendered by one function, so this is a clean cut rather
 * than a parse — the config is meant to be hand-edited, and a wizard that regenerates the
 * whole file would silently eat those edits.
 */
export async function reconfigureRoles(options = {}, services = {}) {
  console.log("");
  p.intro(`${c.bgYellow(c.black(" orca-issue-flow "))} ${c.dim("re-pick the roster")}`);

  const root = services.root ?? detect.repoRoot() ?? process.cwd();
  const configPath = join(root, CONFIG_NAME);
  if (!existsSync(configPath)) {
    p.cancel(`No ${CONFIG_NAME} here. Run \`npx orca-issue-flow\` first.`);
    process.exit(1);
  }

  const current = readFileSync(configPath, "utf8");
  const parsed=readConfig(current);
  const targets=skillTargets(root,current).map(target=>join(target,"SKILL.md")).filter(existsSync);
  if(parsed.get("schema_version")!==2 || targets.length===0 || targets.some(path=>!readFileSync(path,"utf8").includes("Schema compatibility: 2"))) {
    throw new Error("Installed skill/config is outdated. Run `orca-issue-flow upgrade` before `roles`; nothing was changed.");
  }
  const currentRoles=parsed.get("roles",true);
  if(!currentRoles?.items)throw new Error("roles must be a YAML mapping; run upgrade");
  p.log.info(`Current roster in ${c.cyan(CONFIG_NAME)}:`);
  for (const pair of currentRoles.items) {
    const launch=pair.value?.get?.("launch");
    if(typeof launch === "string")p.log.message(c.dim("  "+launch));
  }

  const { roles, orchestrator } = await (services.chooseRoster ?? chooseRoster)();

  if (!options.force) {
    const ok = guard(await p.confirm({ message: "Replace the roles section with this?", initialValue: true }));
    if (!ok) {
      p.cancel("Left the roster alone. Nothing was written.");
      process.exit(0);
    }
  }

  const backup=writeRoles(root,current,roles);
  p.log.info(`Previous config backed up at ${backup}`);
  p.log.success(`Rewrote the roles section of ${CONFIG_NAME}. Other configuration sections are untouched.`);

  // `orchestrator` lives above the cut, so this command cannot write it without breaking
  // the promise it just made. Report the pack's view and let the owner decide.
  const declared = current.match(/^orchestrator:\s*(.+)$/m)?.[1]?.trim();
  if (declared && orchestrator && !declared.includes(orchestrator)) {
    p.log.info(
      `This roster suggests ${c.cyan(orchestrator)} at the wheel; ${CONFIG_NAME} still says ` +
        `${c.cyan(declared)}. Left as it was — change it yourself if you agree.`,
    );
  }
  p.outro(`${c.dim("Docs:")} https://github.com/nuoframework/orca-issue-flow`);
}

/**
 * Pack or per-role, then check the result against the independence rules. Shared by the
 * installer and by `orca-issue-flow roles`, so re-picking the roster later asks exactly
 * the same questions.
 */
export async function chooseRoster() {
  const rosterMode = guard(
    await p.select({
      message: "Set up the roster how?",
      options: [
        ...ROSTER_PACKS.map((pack) => ({
          value: pack.id,
          label: pack.label,
          hint: pack.hint,
        })),
        { value: "__custom__", label: "Pick the agent and model for each role", hint: "per-role choices" },
      ],
      initialValue: "balanced",
    }),
  );

  const pack = findPack(rosterMode);
  const chosen = {};
  for (const role of ROLES) {
    chosen[role.key] = rosterMode === "__custom__" ? await pickRole(role) : packChoice(pack, role);
  }

  const warnings = checkIndependence(chosen);
  if(warnings.length) {
    p.log.warn(warnings.join("\n"));
    p.log.info("Select a supported explicit roster; required family gates cannot be waived by the installer.");
    return chooseRoster();
  }
  let chains;
  try { chains=resolveRoster(chosen); }
  catch(error) {p.log.warn(error.message);return chooseRoster();}
  const families=PHASE_ROLES.map(r=>familyOf(chosen[r.key])).filter(Boolean);
  p.log.success(`Roster and reserves checked — ${new Set(families).size} primary model families. Runtime preflight still checks the actual selected agents.`);

  const notes = correlationNotes(chosen);
  if (notes.length) p.log.message(c.dim(["Native-priority correlation notes:", ...notes.map(note => `  • ${note}`)].join("\n")));

  return {
    roles: ROLES.map((role) => {
      const [primary, reserve1, reserve2] = chains[role.key];
      return {
        key: role.key, label: role.label,
        launch: buildLaunch(primary),
        fallback: buildLaunch(reserve1),
        fallback_2: buildLaunch(reserve2),
      };
    }),
    orchestrator: pack?.orchestrator ?? "a frontier model with measured context usage",
  };
}

/** One role's agent → model → effort chain. Custom entries are always available. */
async function pickRole(role) {
  p.log.step(`${c.bold(role.label)} ${c.dim("— " + role.why)}`);

  const launcherId = guard(
    await p.select({
      message: "Agent",
      initialValue: role.default.launcher,
      options: [
        ...LAUNCHERS.map((l) => ({ value: l.id, label: l.label, hint: l.family })),
        ...(role.service ? [{ value: "__raw__", label: "Custom service command…" }] : []),
      ],
    }),
  );

  if (launcherId === "__raw__") {
    const raw = guard(
      await p.text({
        message: "Full launch command (the orchestrator appends --task/--worktree/--json)",
        placeholder: "orca orchestration worker-start --agent opencode --model provider/model",
        validate: (v) => /^orca orchestration worker-start(?:\s|$)/.test(v?.trim() ?? "") ? undefined : "Use a supervised orca orchestration worker-start command",
      }),
    );
    return { raw: raw.trim() };
  }

  const launcher = findLauncher(launcherId);
  const choice = { launcher: launcherId };

  if (launcher.models.length) {
    const model = guard(
      await p.select({
        message: "Model",
        initialValue: role.default.launcher === launcherId ? (role.default.model ?? "") : launcher.models[0],
        options: [
          ...launcher.models.map((m) => ({
            value: m,
            label: m === "" ? c.dim("(the CLI's default)") : m,
          })),
          { value: "__other__", label: "Another model…" },
        ],
      }),
    );
    choice.model =
      model === "__other__"
        ? guard(await p.text({ message: "Model identifier", placeholder: "provider/model-name" })).trim()
        : model;
  }

  // Terminal CLIs can carry named agent profiles. Offer it, but never default to
  // one: a roster that depends on a profile the package does not create fails on
  // the first run, which is exactly what happened with the judge.
  if (launcher.kind === LAUNCHER_KINDS.terminal) {
    choice.agent = guard(
      await p.text({
        message: `Named agent profile ${c.dim("(blank for none — you must have created it yourself)")}`,
        placeholder: role.default.agent ?? "",
        defaultValue: role.default.agent ?? "",
      }),
    ).trim();
  }

  if (launcher.supportsEffort) {
    choice.effort = guard(
      await p.select({
        message: "Reasoning effort",
        initialValue: role.default.effort ?? "medium",
        options: [
          ...EFFORTS.map((e) => ({ value: e, label: e })),
          { value: "", label: c.dim("(leave unset)") },
        ],
      }),
    );
  }

  return choice;
}

/** Returns true when the entry had to be added. */
function ensureGitignore(root, entry) {
  const path = join(root, ".gitignore");
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (current.split("\n").some((line) => line.trim() === entry)) return false;
  const prefix = current === "" || current.endsWith("\n") ? "" : "\n";
  writeFileSync(path, `${current}${prefix}${entry}\n`, "utf8");
  return true;
}
