import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function repoRoot(cwd = process.cwd()) {
  return git(["rev-parse", "--show-toplevel"], cwd);
}

/**
 * Best guess at the branch feature work should be cut from. Teams that ship through a
 * staging branch (`beta`, `develop`, `staging`) almost never want `main` here, so those
 * win over the remote HEAD when they exist.
 */
export function detectBaseBranch(root) {
  const remotes = git(["branch", "-r", "--format=%(refname:short)"], root);
  const branches = remotes ? remotes.split("\n").map((b) => b.trim()) : [];
  for (const candidate of ["origin/beta", "origin/develop", "origin/staging"]) {
    if (branches.includes(candidate)) return candidate;
  }
  const head = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], root);
  if (head) return head;
  if (branches.includes("origin/main")) return "origin/main";
  if (branches.includes("origin/master")) return "origin/master";
  return "origin/main";
}

export function detectPackageManager(root) {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) return "bun";
  if (existsSync(join(root, "package-lock.json"))) return "npm";
  return null;
}

/**
 * The command that must be green before anything reaches review. We look for a script
 * that already bundles the gates, then fall back to test/check.
 */
export function detectVerifyCommand(root) {
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    // A missing lockfile just means nobody has installed yet — npm is the safe default.
    const pm = detectPackageManager(root) ?? "npm";
    try {
      const scripts = JSON.parse(readFileSync(pkgPath, "utf8")).scripts ?? {};
      for (const name of ["verify", "check", "ci", "validate", "test"]) {
        if (scripts[name]) return `${pm} run ${name}`;
      }
    } catch {
      /* unreadable package.json — fall through to the language guesses */
    }
  }
  if (existsSync(join(root, "Cargo.toml"))) return "cargo test";
  if (existsSync(join(root, "go.mod"))) return "go test ./...";
  if (existsSync(join(root, "Makefile"))) return "make check";
  if (existsSync(join(root, "pyproject.toml"))) return "pytest";
  return null;
}

/** Files that carry the project's rules; every worker is told to read them first. */
export function detectConventionFiles(root) {
  return ["AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", ".cursorrules"].filter((f) =>
    existsSync(join(root, f)),
  );
}

export function detectChangelog(root) {
  return ["CHANGELOG.md", "CHANGELOG.mdx", "docs/CHANGELOG.md"].find((f) => existsSync(join(root, f))) ?? null;
}

export function detectDocsDirs(root) {
  return ["docs", "documentation", "docs-site"].filter((d) => existsSync(join(root, d)));
}

/**
 * Where the host agent looks for skills. Existing directories win; otherwise we offer
 * the conventional locations.
 */
export function detectSkillDirs(root) {
  const known = [
    { path: ".agents/skills", label: ".agents/skills  (Orca / OpenCode / shared)" },
    { path: ".claude/skills", label: ".claude/skills  (Claude Code, this repo)" },
  ];
  const existing = known.filter((k) => existsSync(join(root, k.path)));
  return { existing, known };
}

/** Linear puts a `gitBranchName` on every issue; a repo already using it usually has such branches. */
export function detectTracker(root) {
  const branches = git(["branch", "-a", "--format=%(refname:short)"], root) ?? "";
  if (/\b[a-z]+\/[a-z]{2,5}-\d+/i.test(branches)) return "linear";
  if (existsSync(join(root, ".github"))) return "github";
  return "none";
}

/** A rough issue key prefix (`IDL` in `IDL-86`) read from existing branch names. */
export function detectIssuePrefix(root) {
  const branches = git(["branch", "-a", "--format=%(refname:short)"], root) ?? "";
  const match = branches.match(/\/([a-z]{2,5})-\d+/i);
  return match ? match[1].toUpperCase() : null;
}

export function detectBranchPrefix(root) {
  const branches = git(["branch", "-a", "--format=%(refname:short)"], root) ?? "";
  for (const prefix of ["feature/", "feat/", "issue/"]) {
    if (branches.includes(`/${prefix}`) || branches.includes(`\n${prefix}`) || branches.startsWith(prefix)) {
      return prefix;
    }
  }
  return "feature/";
}

export function hasOrcaCli() {
  try {
    execFileSync("orca", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function listDir(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}
