import test from 'node:test';
import assert from 'node:assert/strict';
import {collectObservations} from '../skill/scripts/collect-observations.mjs';
import {cleanupPlan} from '../skill/scripts/cleanup-plan.mjs';
const now=Date.parse('2026-11-11T12:00:00Z'),id='a'.repeat(64);
const resource={kind:'container',id,host:'host-a',ownerRunId:'run-1',createdByRun:true,creationReceipt:'create.json',ephemeral:true,keepOpen:false,retainUntilRunEnd:false,consumers:['task-1']};
const ledger={runId:'run-1',settledTasks:['task-1'],resources:[resource]};
const docker=(labels={'dev.orca.issue-flow.run':'run-1','dev.orca.issue-flow.keep':'false'})=>({status:0,stdout:JSON.stringify([{Id:id,Config:{Labels:labels},State:{Status:'exited'}}])});
test('real Docker-shaped output is collected without invented runtime ownership fields',()=>{
 const collected=collectObservations(ledger,{host:'host-a',now:()=>now,run:(cmd,args)=>{assert.equal(cmd,'docker');assert.deepEqual(args,['container','inspect',id]);return docker();}});
 assert.equal('ownerRunId' in collected.resources[0].observed,false);
 assert.equal(cleanupPlan(collected,now).actions[0].action,'remove_container');
});
test('an absent container requires no nonexistent labels or keep-open fields',()=>{
 const collected=collectObservations(ledger,{host:'host-a',now:()=>now,run:()=>({status:1,stderr:'Error: No such container: '+id})});
 assert.equal(cleanupPlan(collected,now).completed[0].state,'absent');
});
test('unavailable daemon, unknown labels and foreign hosts fail closed',()=>{
 const unavailable=collectObservations(ledger,{host:'host-a',now:()=>now,run:()=>({status:1,stderr:'Cannot connect to Docker daemon'})});
 assert.equal(cleanupPlan(unavailable,now).actions.length,0);
 const kept=collectObservations(ledger,{host:'host-a',now:()=>now,run:()=>docker({'dev.orca.issue-flow.run':'run-1'})});
 assert.equal(cleanupPlan(kept,now).actions.length,0);
 const foreign=collectObservations(ledger,{host:'host-b',run:()=>{throw new Error('must not query another host');}});
 assert.equal(foreign.resources[0].observed,undefined);
});
test('worker observations produce only a custody-checked native release request, never proof of release',()=>{
 const input={...ledger,resources:[{...resource,kind:'worker',id:'dispatch-1'}]};
 const collected=collectObservations(input,{host:'host-a',now:()=>now,run:(cmd,args)=>{assert.equal(cmd,'orca');assert.ok(args.includes('dispatch-1'));return {status:0,stdout:JSON.stringify({ok:true,result:{id:'dispatch-1'}})};}});
 const plan=cleanupPlan(collected,now);
 assert.equal(plan.actions[0].action,'request_guarded_worker_release');assert.equal(plan.completed.length,0);
 assert.equal(cleanupPlan({...collected,settledTasks:[]},now).actions.length,0);
});
