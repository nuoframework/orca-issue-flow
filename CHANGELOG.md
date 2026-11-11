# Changelog

## 0.2.0 — 2026-11-11

- Add schema-2 upgrade with skill/config backups, missing-field migration, preserved owner
  settings/comments, rollback on application failure and an explicit skill-only mode.
- Validate generated roster reserves as well as primaries; fix Enter/default batch validation.
- Add enforced/instructed context modes with explicit choice and visible limitations.
  Strict mode still requires a host-provided per-request adapter; no universal one is bundled.
- Define unaffected-scope review carries and revision-bound owner risk acceptance; red gates
  and missing strict admission stay blocking. Final/adversarial reviews always rerun.
- Isolate executable review checks, exclude run artifacts locally and document custody-aware
  resume rather than implicitly recreating the issue workflow.
- Add deterministic host-scoped Docker/Orca observations and guarded cleanup requests;
  missing containers need no fabricated runtime fields. Preserve unrelated/active/user-kept work.
- Keep medium/low effort defaults; use Terra for normal implementation, stronger omission/QA
  primaries and a native Sonnet adversarial default. Preserve dated model/price evidence.
- Add YAML roundtrip, migration, rollback, CLI, cleanup and review-transition regressions;
  use Node test discovery rather than shell-dependent wildcard expansion.

No full live issue run or destructive-resource cleanup has been claimed by these tests.
