import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupPlan} from '../skill/scripts/cleanup-plan.mjs';
const now=Date.parse('2026-11-10T12:00:00Z');
const id='a'.repeat(64);
const resource=(extra={})=>({kind:'container',id,host:'local',ownerRunId:'run-1',createdByRun:true,creationReceipt:'create-1',ephemeral:true,keepOpen:false,retainUntilRunEnd:false,consumers:['task-1'],observed:{source:'docker-inspect',id,host:'local',ownerRunId:'run-1',runLabel:'run-1',state:'running',keepOpen:false,measuredAt:new Date(now).toISOString()},...extra});
const plan=r=>cleanupPlan({runId:'run-1',settledTasks:['task-1'],resources:r},now);
test('only proven ephemeral containers whose consumers settled are proposed for removal',()=>{
 assert.equal(plan([resource()]).actions[0].action,'stop_and_remove_container');
 for(const extra of [{ownerRunId:'other'},{ephemeral:false},{keepOpen:true},{createdByRun:false},{consumers:['still-working']},{consumers:[]},{creationReceipt:''},{retainUntilRunEnd:true}]) assert.equal(plan([resource(extra)]).actions.length,0);
});
test('fresh exact runtime identity and labels are required; conflicting entries block cleanup',()=>{
 for(const live of [{runLabel:'other'},{host:'remote'},{id:'b'.repeat(64)},{measuredAt:'2026-11-10T11:58:00Z'},{keepOpen:true}]) {
  const r=resource();r.observed={...r.observed,...live};assert.equal(plan([r]).actions.length,0);
 }
 assert.equal(plan([resource(),resource()]).actions.length,0);
});
test('workers require settled dispatch proof and release through their coordinator',()=>{
 const r=resource({kind:'worker',id:'dispatch-1'});r.observed={...r.observed,id:r.id,source:'orca-normalized',dispatchState:'succeeded',coordinatorOwned:true,releaseEligible:true};
 assert.equal(plan([r]).actions[0].executor,'coordinator');
 for(const live of [{dispatchState:'waiting'},{dispatchState:'running'},{releaseEligible:false},{coordinatorOwned:false}]) assert.equal(plan([{...r,observed:{...r.observed,...live}}]).actions.length,0);
});
test('raw PIDs and reused process identities are never enough to terminate a process',()=>{
 const r=resource({kind:'process',id:'123',supervisorId:'job-1',startToken:'start-1'});r.observed={...r.observed,id:r.id,supervisorId:'job-1',startToken:'start-1',supervisorOwned:true};
 assert.equal(plan([r]).actions[0].action,'stop_via_supervisor');
 assert.equal(plan([{...r,observed:{...r.observed,startToken:'another-start'}}]).actions.length,0);
 assert.equal(plan([{...r,supervisorId:null}]).actions.length,0);
});

test('duplicate conflicts are host-scoped and every retained entry keeps its host',()=>{
 const make=host=>{
  const r=resource({kind:'worker',id:'dispatch-1',host});
  r.observed={...r.observed,id:r.id,host,source:'orca-normalized',dispatchState:'succeeded',coordinatorOwned:true,releaseEligible:true};
  return r;
 };
 const p=plan([make('host-a'),make('host-a'),make('host-b')]);
 assert.deepEqual(p.actions.map(a=>a.host),['host-b']);
 assert.equal(p.retained[0].host,'host-a');
 const retained=resource({host:'remote',ephemeral:false});retained.observed.host='remote';
 assert.equal(plan([retained]).retained[0].host,'remote');
});

test('unknown and kept release receipts override contradictory release eligibility',()=>{
 for(const releaseState of ['release_unknown','release_pending','retained']) {
  const r=resource({kind:'worker',id:'dispatch-1'});r.observed={...r.observed,id:r.id,source:'orca-normalized',dispatchState:'succeeded',coordinatorOwned:true,releaseEligible:true,releaseState};
  assert.equal(plan([r]).actions.length,0);
 }
});

test('confirmed completion is distinguished from an accepted cleanup action',()=>{
 const absent=resource();absent.observed={source:"docker-inspect",id,host:"local",measuredAt:new Date(now).toISOString(),exists:false};
 assert.equal(plan([absent]).completed[0].state,'absent');
 const created=resource();created.observed.state='created';
 assert.equal(plan([created]).actions[0].action,'remove_container');
 const running=plan([resource()]);
 assert.equal(running.completed.length,0);
 assert.equal(running.actions[0].action,'stop_and_remove_container');
 const released=resource({kind:'worker',id:'dispatch-1'});released.observed={...released.observed,id:released.id,source:'orca-normalized',dispatchState:'succeeded',releaseState:'released'};
 assert.equal(plan([released]).completed[0].state,'released');
 assert.throws(()=>cleanupPlan({runId:'run-1',settledTasks:[],resources:[],finalizeRun:'false'},now));
});
