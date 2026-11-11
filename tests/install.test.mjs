import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { applyInstall } from '../src/init.mjs';
import { ROLES, buildLaunch, roleChoices } from '../src/presets.mjs';

test('installer delivers the guard, critical roster and enforcement contract together', () => {
 const root = mkdtempSync(join(tmpdir(), 'orca-flow-install-'));
 try {
  const cfg = { base_branch:'origin/main', pr_base:'main', branch_prefix:'issue/', conventions_files:[], docs_dirs:[], changelog:null, language:'Spanish', verify:{command:'npm test'}, context:{digest_gate_logs_over:200,raw_log_after_rounds:2}, tracker:'none', deep_review_paths:['**/auth/**'], deep_review_lines:300, adversarial_topics:[], max_review_rounds:3, roles:ROLES.map(r=>{ const [a,b,c]=roleChoices(r); return {key:r.key,label:r.label,launch:buildLaunch(a),fallback:buildLaunch(b),fallback_2:buildLaunch(c)}; }) };
  const installed = applyInstall(root, cfg, '.agents/skills');
  const config = readFileSync(join(root,'.orca-flow.yml'),'utf8');
  assert.match(config,/max_window_percent: 60/);
  assert.match(config,/require_measured_usage: true/);
  assert.match(config,/adversarial: always/);
  assert.match(config,/review_security:/);
  assert.match(config,/janitor:/);
  assert.match(config,/execution: batched/);
  assert.match(config,/cleanup:/);
  assert.equal((config.match(/    fallback_2: orca orchestration worker-start/g)??[]).length, ROLES.length);
  assert.doesNotMatch(config,/review_light_1:/);
  for (const file of ['scripts/context-guard.mjs','references/context.md','references/models.md','references/model-recommender-runs.json','references/orca.md','references/cleanup.md','scripts/cleanup-plan.mjs','scripts/review-batches.mjs']) assert.ok(existsSync(join(installed.skillTarget,file)),file);
  const parsed=parse(config);
  assert.equal(parsed.schema_version,2);
  assert.equal(parsed.context.enforcement,'enforced');
  assert.equal(parsed.context.require_measured_usage,true);
  assert.ok(existsSync(join(installed.skillTarget,'scripts/review-state.mjs')));
  assert.ok(existsSync(join(installed.skillTarget,'scripts/collect-observations.mjs')));
 } finally { rmSync(root,{recursive:true,force:true}); }
});
