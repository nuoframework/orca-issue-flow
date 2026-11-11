import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {parse} from 'yaml';
import {positiveIntegerOrDefault} from '../src/validation.mjs';
import {renderConfig} from '../src/config.mjs';
import {installedRoles} from '../src/project-config.mjs';
const root=resolve('.');
const run=(path,args=[],options={})=>spawnSync(process.execPath,[resolve(path),...args],{encoding:'utf8',...options});
test('batch prompt accepts Enter/default and rejects invalid capacities',()=>{
 for(const v of ['',undefined,'3','1'])assert.equal(positiveIntegerOrDefault(v),undefined);
 for(const v of ['0','-1','1.5','bad'])assert.equal(typeof positiveIntegerOrDefault(v),'string');
});
test('script entrypoints return real CLI exit codes for valid and invalid input',()=>{
 const schedule=run('skill/scripts/review-batches.mjs',[],{input:JSON.stringify({roles:['review_qa','review_tests'],execution:'parallel',max_parallel:null})});
 assert.equal(schedule.status,0);assert.equal(JSON.parse(schedule.stdout).batches[0].length,2);
 const denied=run('skill/scripts/review-batches.mjs',[],{input:JSON.stringify({roles:['review_qa'],execution:'parallel',max_parallel:1})});
 assert.equal(denied.status,2);
 assert.equal(run('skill/scripts/context-guard.mjs',[],{input:'{}'}).status,2);
 assert.equal(run('skill/scripts/cleanup-plan.mjs',[],{input:JSON.stringify({runId:'r',resources:[],settledTasks:[]})}).status,0);
 assert.equal(run('skill/scripts/review-state.mjs',[],{input:'{}'}).status,2);
 assert.equal(run('skill/scripts/collect-observations.mjs',[]).status,2);
});
test('upgrade CLI preserves custom data, and roles refuses old config before prompting',()=>{
 const temp=mkdtempSync(join(tmpdir(),'flow-cli-'));
 try {
  writeFileSync(join(temp,'.orca-flow.yml'),'base_branch: origin/main\nroles: {}\ncustom: preserved\n');
  const old=run('bin/cli.mjs',['roles','--force'],{cwd:temp});assert.equal(old.status,1);assert.match(old.stderr,/upgrade/);
  const upgraded=run('bin/cli.mjs',['upgrade','--context-mode','instructed'],{cwd:temp});
  assert.equal(upgraded.status,0,upgraded.stderr);
  const cfg=parse(readFileSync(join(temp,'.orca-flow.yml'),'utf8'));
  assert.equal(cfg.custom,'preserved');assert.equal(cfg.context.enforcement,'instructed');
  assert.ok(existsSync(join(temp,'.agents/skills/orca-issue-flow/scripts/collect-observations.mjs')));
  const missing=run('bin/cli.mjs',['upgrade','--context-mode'],{cwd:temp});assert.equal(missing.status,1);
 }finally {rmSync(temp,{recursive:true,force:true});}
});
test('rendered modes and explicit context settings survive YAML roundtrip',()=>{
 const cfg={base_branch:'origin/main',pr_base:'main',branch_prefix:'issue/',conventions_files:[],docs_dirs:[],language:'Spanish',verify:{command:'npm test'},context:{digest_gate_logs_over:200,raw_log_after_rounds:2},tracker:'none',deep_review_paths:[],deep_review_lines:300,adversarial_topics:[],max_review_rounds:3,roles:installedRoles()};
 for(const [execution,cap] of [['sequential',1],['batched',3],['parallel',null]])for(const enforcement of ['enforced','instructed']){
  const parsed=parse(renderConfig({...cfg,review_policy:{execution,max_parallel:cap},context:{...cfg.context,enforcement}}));
  assert.equal(parsed.review_policy.max_parallel,cap);assert.equal(parsed.context.enforcement,enforcement);
  assert.equal(parsed.context.require_measured_usage,enforcement==='enforced');
 }
});
test('relative Markdown references in the packaged skill resolve',()=>{
 const files=[];const scan=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())scan(path);else if(path.endsWith('.md'))files.push(path);}};scan(join(root,'skill'));
 for(const path of files)for(const match of readFileSync(path,'utf8').matchAll(/\]\(([^)]+)\)/g)){
  const target=match[1].split('#')[0];
  if(!target||/^https?:|^mailto:/.test(target))continue;
  assert.ok(existsSync(resolve(dirname(path),target)),`${path} -> ${target}`);
 }
});

test('CLI rejects typos and supports option values before the command and equals syntax',async()=>{
 const {cliOptions}=await import('../src/cli-options.mjs');
 assert.throws(()=>cliOptions(['upgrade','--skill-ony']),/Unknown option/);
 assert.equal(cliOptions(['--skills-path','custom','upgrade']).skillsPath,'custom');
 assert.equal(cliOptions(['upgrade','--context-mode=instructed']).enforcement,'instructed');
 assert.equal(cliOptions(['init','--context-mode','enforced']).enforcement,'enforced');
 assert.throws(()=>cliOptions(['roles','--context-mode','instructed']),/requires init or upgrade/);
 assert.throws(()=>cliOptions(['init','--skill-only']),/require upgrade/);
});
