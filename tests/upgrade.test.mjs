import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse} from 'yaml';
import {upgradeProject} from '../src/upgrade.mjs';
import {installedRoles,migrateConfig,replaceRoles} from '../src/project-config.mjs';
import {ensureRunExclude} from '../src/run-exclude.mjs';
import {execFileSync} from 'node:child_process';
const legacy=`# owner comment\nbase_branch: origin/beta\nverify:\n  command: custom-test\ncontext:\n  digest_gate_logs_over: 71 # deliberate\nroles:\n  implementer:\n    launch: orca orchestration worker-start --agent codex --model custom-id\n  review_light_1:\n    launch: old-light\ncustom:\n  keep: true\n`;
test('migration adds fields without losing custom values/comments, backup or legacy roles',()=>{
 const root=mkdtempSync(join(tmpdir(),'flow-upgrade-'));
 try {
  writeFileSync(join(root,'.orca-flow.yml'),legacy);
  const target=join(root,'.claude/skills/orca-issue-flow');mkdirSync(target,{recursive:true});
  writeFileSync(join(target,'SKILL.md'),'---\nname: orca-issue-flow\n---\nold skill');
  writeFileSync(join(target,'owner-note.txt'),'keep backup');
  const result=upgradeProject(root);
  const source=readFileSync(join(root,'.orca-flow.yml'),'utf8'),cfg=parse(source);
  assert.equal(cfg.schema_version,2);assert.equal(cfg.context.enforcement,'enforced');
  assert.equal(cfg.context.digest_gate_logs_over,71);assert.equal(cfg.custom.keep,true);
  assert.equal(cfg.roles.implementer.launch,'orca orchestration worker-start --agent codex --model custom-id');
  assert.ok(cfg.roles.review_light_1);assert.ok(cfg.roles.janitor);
  assert.ok(source.includes('# owner comment'));assert.ok(source.includes('# deliberate'));
  assert.equal(readFileSync(join(result.backup,'.orca-flow.yml'),'utf8'),legacy);
  assert.equal(readFileSync(join(result.backup,'skill-0/owner-note.txt'),'utf8'),'keep backup');
  assert.equal(existsSync(join(target,'owner-note.txt')),false);
  assert.ok(existsSync(join(target,'scripts/collect-observations.mjs')));
  assert.match(readFileSync(join(target,'SKILL.md'),'utf8'),/Schema compatibility: 2/);
 } finally {rmSync(root,{recursive:true,force:true});}
});
test('skill-only preserves config bytes and explicit instructed mode is never silently selected',()=>{
 const root=mkdtempSync(join(tmpdir(),'flow-skill-only-'));
 try {
  writeFileSync(join(root,'.orca-flow.yml'),legacy);
  upgradeProject(root,{skillOnly:true});
  assert.equal(readFileSync(join(root,'.orca-flow.yml'),'utf8'),legacy);
  const {source}=migrateConfig(legacy,{enforcement:'instructed'});
  assert.equal(parse(source).context.enforcement,'instructed');
  assert.throws(()=>migrateConfig(legacy,{enforcement:'auto'}));
  writeFileSync(join(root,'.orca-flow.yml'),'roles: invalid\n');
  assert.throws(()=>upgradeProject(root));
  assert.equal(readFileSync(join(root,'.orca-flow.yml'),'utf8'),'roles: invalid\n');
 } finally {rmSync(root,{recursive:true,force:true});}
});
test('roles replacement preserves exact surrounding bytes, including keys after roles',()=>{
 const before='# leading\nbase_branch: origin/beta # owner\n';
 const after='# trailing comment\ncustom_setting: "yes"\n';
 const result=replaceRoles(before+'roles:\n  old:\n    launch: old\n'+after,installedRoles());
 assert.ok(result.startsWith(before));assert.ok(result.endsWith(after));
 assert.equal(parse(result).custom_setting,'yes');assert.ok(parse(result).roles.review_security);
});
test('run artifacts use local Git exclusion, leaving tracked files clean',()=>{
 const root=mkdtempSync(join(tmpdir(),'flow-exclude-'));
 try {
  execFileSync('git',['init','-q',root]);
  writeFileSync(join(root,'tracked.txt'),'keep');execFileSync('git',['add','tracked.txt'],{cwd:root});
  const before=execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'});
  assert.equal(ensureRunExclude(root),true);assert.equal(ensureRunExclude(root),false);
  mkdirSync(join(root,'.orca-run'));writeFileSync(join(root,'.orca-run','log'),'temporary');
  assert.equal(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}),before);
  assert.equal(existsSync(join(root,'.gitignore')),false);
 } finally {rmSync(root,{recursive:true,force:true});}
});

test('failed config commit rolls the installed skill back and preserves another pending file',()=>{
 const root=mkdtempSync(join(tmpdir(),'flow-rollback-'));
 try {
  writeFileSync(join(root,'.orca-flow.yml'),legacy);
  writeFileSync(join(root,'.orca-flow.yml.pending'),'another operation');
  const target=join(root,'.agents/skills/orca-issue-flow');mkdirSync(target,{recursive:true});
  const old='---\nname: orca-issue-flow\n---\nold but intact';writeFileSync(join(target,'SKILL.md'),old);
  assert.throws(()=>upgradeProject(root));
  assert.equal(readFileSync(join(target,'SKILL.md'),'utf8'),old);
  assert.equal(readFileSync(join(root,'.orca-flow.yml'),'utf8'),legacy);
  assert.equal(readFileSync(join(root,'.orca-flow.yml.pending'),'utf8'),'another operation');
 }finally {rmSync(root,{recursive:true,force:true});}
});

test('roles replacement preserves a shared YAML anchor and the following alias',()=>{
 const source='roles: &shared\n  old: {launch: previous}\nbackup_ref: *shared\n';
 const replaced=replaceRoles(source,installedRoles());
 const data=parse(replaced);
 assert.ok(data.backup_ref.review_security);
 assert.deepEqual(data.backup_ref,data.roles);
});

test('migration derives concurrency defaults from mode and rejects conflicting caps before writing',()=>{
 for(const [execution,cap] of [['parallel',null],['sequential',1],['batched',3]]) {
  const {source}=migrateConfig(`review_policy: {execution: ${execution}}\nroles: {}\n`);
  assert.equal(parse(source).review_policy.max_parallel,cap);
 }
 assert.throws(()=>migrateConfig('review_policy: {execution: parallel, max_parallel: 3}\nroles: {}\n'),/max_parallel/);
});

test('migration marks incompatible preserved primaries/reserves as blocking until roles is repaired',()=>{
 const source='roles:\n  implementer:\n    launch: orca orchestration worker-start --agent claude --model claude-opus-5-5\n';
 const migrated=migrateConfig(source);
 assert.equal(parse(migrated.source).roles.__requires_review,true);
 assert.ok(migrated.warnings.some(w=>w.includes('BLOCKING roster review')));
 assert.equal(parse(migrated.source).roles.implementer.launch,parse(source).roles.implementer.launch);
 const repaired=replaceRoles(migrated.source,installedRoles());
 assert.equal(parse(repaired).roles.__requires_review,undefined);
});

test('an explicit skill directory augments installations without dropping absolute owner paths',()=>{
 const root=mkdtempSync(join(tmpdir(),'flow-multiple-skills-'));
 try {
  const absolute=join(root,'.agents/skills');
  const source=`# keep locations\nskill_directories:\n  - ${JSON.stringify(absolute)} # owner absolute\n  - .claude/skills\nroles: {}\n`;
  writeFileSync(join(root,'.orca-flow.yml'),source);
  for(const dir of [absolute,join(root,'.claude/skills')]) {
   const target=join(dir,'orca-issue-flow');mkdirSync(target,{recursive:true});
   writeFileSync(join(target,'SKILL.md'),'---\nname: orca-issue-flow\n---\nold');
  }
  upgradeProject(root,{skillsPath:'.claude/skills'});
  const current=readFileSync(join(root,'.orca-flow.yml'),'utf8');
  assert.deepEqual(parse(current).skill_directories,[absolute,'.claude/skills']);
  assert.ok(current.includes('# owner absolute'));
  for(const dir of [absolute,join(root,'.claude/skills')]) assert.match(readFileSync(join(dir,'orca-issue-flow/SKILL.md'),'utf8'),/Schema compatibility: 2/);
 }finally {rmSync(root,{recursive:true,force:true});}
});

test('roles writes are backed up and refuse stale wizard input or an owned pending lock',async()=>{
 const {writeRoles}=await import('../src/roles-file.mjs');
 const root=mkdtempSync(join(tmpdir(),'flow-role-write-'));
 try {
  const path=join(root,'.orca-flow.yml');writeFileSync(path,legacy);
  const backup=writeRoles(root,legacy,installedRoles());
  assert.equal(readFileSync(backup,'utf8'),legacy);
  assert.ok(parse(readFileSync(path,'utf8')).roles.review_security);
  assert.throws(()=>writeRoles(root,legacy,installedRoles()),/changed/);
  const current=readFileSync(path,'utf8');writeFileSync(path+'.pending','another operation');
  assert.throws(()=>writeRoles(root,current,installedRoles()));
  assert.equal(readFileSync(path+'.pending','utf8'),'another operation');
 }finally {rmSync(root,{recursive:true,force:true});}
});

test('an absolute skill installation outside the repository is discovered without a default copy',async()=>{
 const {skillTargets}=await import('../src/upgrade.mjs');
 const {reconfigureRoles}=await import('../src/init.mjs');
 const root=mkdtempSync(join(tmpdir(),'flow-outside-root-'));
 const external=mkdtempSync(join(tmpdir(),'flow-outside-skills-'));
 try {
  const source=`skill_directories: [${JSON.stringify(external)}]\nroles: {}\n`;
  writeFileSync(join(root,'.orca-flow.yml'),source);
  upgradeProject(root);
  const updated=readFileSync(join(root,'.orca-flow.yml'),'utf8');
  assert.deepEqual(skillTargets(root,updated),[join(external,'orca-issue-flow')]);
  assert.match(readFileSync(join(skillTargets(root,updated)[0],'SKILL.md'),'utf8'),/Schema compatibility: 2/);
  await reconfigureRoles({force:true},{root,chooseRoster:async()=>({roles:installedRoles(),orchestrator:"coordination model"})});
  assert.ok(parse(readFileSync(join(root,".orca-flow.yml"),"utf8")).roles.review_security);
  assert.equal(parse(readFileSync(join(root,".orca-flow.yml"),"utf8")).roles.__requires_review,undefined);
 }finally {rmSync(root,{recursive:true,force:true});rmSync(external,{recursive:true,force:true});}
});
