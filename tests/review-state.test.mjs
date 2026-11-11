import test from 'node:test';
import assert from 'node:assert/strict';
import {carryReview,deliveryState} from '../skill/scripts/review-state.mjs';
const a='a'.repeat(40),b='b'.repeat(40),criteria='c'.repeat(64),verdict='d'.repeat(64);
const report={role:'review_security',reviewedHead:a,criteriaHash:criteria,verdictHash:verdict,verdict:'approve',coverageComplete:true,scope:{complete:true,files:['auth.js'],dependencies:['schema.sql']}};
const change={fromHead:a,toHead:b,criteriaHash:criteria,verdictHash:verdict,changedPaths:['docs.md'],diffEvidence:'diff-paths.json',attestation:{by:'review_final',evidence:'attestation.md',reason:'No scoped file or dependency changed'}};
const base={head:b,criteriaHash:criteria,verdictHash:verdict,verifyGreen:true,gateEvidence:'gates.json',context:{enforcement:'enforced',adapterVerified:true,breaches:0},requiredRoles:['review_security'],reports:[{...report,carry:change}],findings:[]};
test('unaffected-scope carry requires exact revision, digests and evidence',()=>{
 assert.equal(carryReview(report,change).allowed,true);
 for(const delta of [{changedPaths:['schema.sql']},{criteriaHash:'e'.repeat(64)},{attestation:null},{fromHead:b},{changedPaths:['../other']}])assert.equal(carryReview(report,{...change,...delta}).allowed,false);
 for(const role of ['review_final','review_adversarial'])assert.equal(carryReview({...report,role},change).allowed,false);
 assert.equal(deliveryState(base).status,'ready');
 assert.equal(deliveryState({...base,head:a}).status,'ready');
 assert.equal(deliveryState({...base,head:'e'.repeat(40)}).status,'needs_owner_decision');
});
test('named owner acceptance is revision-bound and never masks red gates or strict context failure',()=>{
 const input={...base,findings:[{id:'S1',severity:'SHOULD',status:'disputed'}]};
 assert.equal(deliveryState(input).status,'needs_owner_decision');
 const ownerAcceptance={explicit:true,head:b,criteriaHash:criteria,verdictHash:verdict,source:'gate-2/owner-message',reason:'Known trade-off accepted',ids:['S1']};
 assert.equal(deliveryState({...input,ownerAcceptance}).status,'ready_with_accepted_risks');
 assert.equal(deliveryState({...input,ownerAcceptance:{...ownerAcceptance,head:a}}).status,'needs_owner_decision');
 assert.equal(deliveryState({...input,ownerAcceptance,verifyGreen:false}).status,'blocked');
 assert.equal(deliveryState({...input,ownerAcceptance,context:{enforcement:'enforced',adapterVerified:false,breaches:0}}).status,'blocked');
});
test('missing required coverage is visible and instructed mode must be explicit/disclosed',()=>{
 const input={...base,reports:[],context:{enforcement:'instructed',explicitOptIn:true,disclosed:true}};
 assert.deepEqual(deliveryState(input).pending,['coverage:review_security']);
 assert.equal(deliveryState({...input,context:{...input.context,disclosed:false}}).status,'blocked');
 assert.equal(deliveryState({...input,ownerAcceptance:{explicit:true,head:b,criteriaHash:criteria,verdictHash:verdict,source:'owner-receipt',reason:'Manual verification supplied',ids:['coverage:review_security']}}).status,'ready_with_accepted_risks');
});

test('carry cannot bypass directory-prefix or equivalent normalized path changes',()=>{
 for(const [scope,changed] of [['src/auth','src/auth/token.mjs'],['./src/a.mjs','src/a.mjs'],['src/auth/token.mjs','src/auth']]) {
  assert.equal(carryReview({...report,scope:{complete:true,files:[scope],dependencies:[]}},{...change,changedPaths:[changed]}).allowed,false);
 }
 for(const scope of ['.','src/auth/','../auth'])assert.equal(carryReview({...report,scope:{complete:true,files:[scope],dependencies:[]}},change).allowed,false);
 assert.equal(carryReview({...report,scope:{complete:true,files:['src/auth'],dependencies:[]}},{...change,changedPaths:['src/authentication.mjs']}).allowed,true);
});

test('conflicting duplicate review reports cannot approve delivery by array order',()=>{
 assert.equal(deliveryState({...base,reports:[...base.reports,{...base.reports[0],verdict:'fix'}]}).status,'blocked');
});

test('a current rejection always supersedes an old carried approval in either order',()=>{
 const reject={...report,reviewedHead:b,verdict:'fix'};
 for(const reports of [[base.reports[0],reject],[reject,base.reports[0]]]){
  const result=deliveryState({...base,reports});
  assert.equal(result.status,'needs_owner_decision');
  assert.deepEqual(result.pending,['coverage:review_security']);
 }
});
