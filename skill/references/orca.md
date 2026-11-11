# Orca compatibility and recent features — 2026-11-08

Inspected local CLI: **1.4.253**. Loaded its version-matched `orca-cli`, `orchestration`,
coordinator-loop and messaging-and-gates guides, and worker-start/show/read help. Public
[changelog](https://www.onorca.dev/changelog) currently highlights releases through 1.4.250;
public notes and installed command capability are separate sources of evidence.

| Verified capability | Workflow decision |
|---|---|
| Supervised workers may run as Chat or Terminal | Use orchestration messages, dispatch IDs and worker-read, never assume every worker has a terminal. |
| worker-start supports spec-file, deps, explicit models, OpenCode in an existing worktree | Generate file-based prompts; keep dependency tasks, verify host catalog and launch supervised OpenCode directly. |
| Current orchestration guide wakes the coordinator with results and auto-closes finished workers | Dispatch independent tasks then end the turn; remove polling, long check --wait loops and compulsory terminal release. Follow receipt next actions. |
| worker-read supports bounded cursor reads and transcript/auto source | Read only needed evidence; preserve source affinity and reset a cursor only on source_changed. |
| Durable launch receipts and request-show; worker-show distinguishes permission waits | Never resend on silence or treat waiting for a person as a crashed worker. Follow current recovery guidance. |
| Fresh child workspaces and per-workspace browser profiles | Keep one product writer. Isolate QA fixtures, browser profiles and output folders when concurrent reviewers run commands. |

Recent public changes worth using:

- [1.4.250, November 5](https://www.onorca.dev/changelog/1-4-250): turn-level changed
  files, line counts and patches improve owner review. The workflow still binds approvals
  to a manifest/HEAD rather than treating visual activity as verification.
- [1.4.242, October 27](https://www.onorca.dev/changelog/1-4-242): fresh chats and
  browser session scoping support bounded handoffs and isolated QA. A fresh chat must
  receive a small checkpoint, not automatically inherit the old transcript.
- [1.4.229, October 17](https://www.onorca.dev/changelog/1-4-229) and
  [1.4.215, September 27](https://www.onorca.dev/changelog/1-4-215): context usage is
  visible in Native Chat. Visibility is helpful to operators but does not establish a
  machine-readable, synchronous pre-request admission hook for every provider.
- [1.4.225, October 14](https://www.onorca.dev/changelog/1-4-225): supervised workers
  can be native chats, reinforcing the need to avoid terminal-only coordination.

No universal context-cap/cache flag was found in the inspected public notes or CLI help.
The supplied context checker is usable by an enforcing runtime adapter; it is not already
wired into every runtime. Block unsupported runs instead of promising a hard cap. A plugin
might provide that integration, but implementing and installing code with runtime access
is a separate, runtime-specific change and is not silently done by this instruction package.

Not adopted: automated schedules (the flow is issue-driven), password saving (unnecessary
for code review), nested critic-worker trees (extra context and cost without proven value),
or automatic PR comments (requires the owner's explicit delivery authorization).

## November 11 compatibility check

Installed CLI now reports 1.4.256. Its read-only help confirms `run-show --id <run>` and
`run-use --id <run>`, plus the restricted meaning of --takeover-legacy; resume.md uses those
actual flags. This does not establish arbitrary coordinator transfer or universal context
interception. Skill instructions still load the installed host's current guide at run time.
Settled owned workers can be released at cleanup checkpoints; there is no unconditional
terminal close or assumption that every worker has a terminal.
