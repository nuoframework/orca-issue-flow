import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROSTER_PACKS, packChoice, checkIndependence, buildLaunch, familyOf } from '../src/presets.mjs';
test('every preset preserves diversity and supervised OpenCode launches', () => {
 for (const pack of ROSTER_PACKS) {
  const choices = Object.fromEntries(ROLES.map(r => [r.key, packChoice(pack, r)]));
  assert.deepEqual(checkIndependence(choices), [], pack.id);
  for (const c of Object.values(choices)) assert.match(buildLaunch(c), /^orca orchestration worker-start --agent /);
 }
 assert.equal(familyOf({launcher:'opencode',model:'opencode-go/kimi-k3.1-pro'}),'moonshot');
});
test('new specialist roles are checked for implementer overlap', () => {
 assert.ok(checkIndependence({implementer:{launcher:'claude'},review_security:{launcher:'claude'}}).some(w => w.includes('review_security')));
});

test('all packs provide three distinct supported choices per role, each preserving independence', async () => {
 const {roleChoices} = await import('../src/presets.mjs');
 const allowed = new Set(['claude','codex','grok','opencode']);
 for (const pack of ROSTER_PACKS) {
  const actual = Object.fromEntries(ROLES.map(r=>[r.key,packChoice(pack,r)]));
  for (const role of ROLES) {
   const chain = roleChoices(role,actual[role.key]);
   assert.equal(chain.length,3,`${pack.id}/${role.key}`);
   assert.equal(new Set(chain.map(c=>`${c.launcher}:${c.model}`)).size,3);
   for (const choice of chain) {
    assert.ok(allowed.has(choice.launcher));
    assert.deepEqual(checkIndependence({...actual,[role.key]:choice}),[],`${pack.id}/${role.key}/${choice.model}`);
    assert.match(buildLaunch(choice),new RegExp(`--agent ${choice.launcher} --model `));
   }
  }
 }
});

test('custom primary stays first and repeated default is not added twice', async () => {
 const {roleChoices} = await import('../src/presets.mjs');
 const role=ROLES.find(r=>r.key==='judge');
 const primary={launcher:'claude',model:'claude-sonnet-5-5',effort:'medium'};
 const chain=roleChoices(role,primary);
 assert.equal(chain[0],primary);
 assert.equal(chain.length,3);
 assert.equal(chain.filter(c=>c.model===primary.model).length,1);
});

test('native preference allows OpenCode only for scoped economy/support reserves', async () => {
 const {roleChoices} = await import('../src/presets.mjs');
 for (const pack of ROSTER_PACKS) {
  const primaries=ROLES.map(r=>packChoice(pack,r));
  assert.ok(primaries.filter(c=>['claude','codex'].includes(c.launcher)).length >= ROLES.length - 2);
  assert.equal(primaries.filter(c=>c.launcher==='opencode').length,0);
  for (const role of ROLES) for (const c of roleChoices(role,packChoice(pack,role))) {
   if(c.launcher==='opencode') assert.ok(['reader','review_docs','implementer','janitor'].includes(role.key),role.key);
  }
 }
});

test('native overlap is recorded while planner separation and closure gates remain required', async () => {
 const {correlationNotes}=await import('../src/presets.mjs');
 const actual=Object.fromEntries(ROLES.map(r=>[r.key,r.default]));
 assert.deepEqual(checkIndependence(actual),[]);
 assert.ok(correlationNotes(actual).some(n=>n.startsWith('Judge shares')));
 assert.ok(correlationNotes(actual).some(n=>n.includes('review_tests')));
 assert.ok(checkIndependence({...actual,plan_b:actual.plan_a}).some(n=>n.includes('Plan A')));
 assert.ok(checkIndependence({...actual,review_final:actual.implementer}).some(n=>n.includes('review_final')));
 assert.ok(checkIndependence({...actual,review_security:actual.implementer}).some(n=>n.includes('review_security')));
});

test('routine effort stays bounded across all packs and reserves', async () => {
 const {roleChoices} = await import('../src/presets.mjs');
 for (const pack of ROSTER_PACKS) for (const role of ROLES) {
  for (const c of roleChoices(role,packChoice(pack,role))) {
   if (c.launcher!=='opencode') assert.ok(['low','medium'].includes(c.effort),`${pack.id}/${role.key}/${c.effort}`);
  }
 }
 for (const key of ['review_ui','review_docs','review_qa']) {
  const role=ROLES.find(r=>r.key===key);
  assert.ok(roleChoices(role).filter(c=>c.launcher!=='opencode').every(c=>c.effort==='low'));
 }
 assert.equal(ROLES.find(r=>r.key==='reader').default.effort,'low');
});


test('default implementation is cheaper Terra and Astra is absent from preset chains', async () => {
 const {roleChoices} = await import('../src/presets.mjs');
 const implementer=ROLES.find(r=>r.key==='implementer');
 assert.equal(implementer.default.model,'gpt-6.1-terra');
 assert.equal(implementer.fallback.model,'opencode/deepseek-v4.1-flash');
 assert.equal(implementer.fallback_2.model,'gpt-6.1-sol');
 for (const pack of ROSTER_PACKS) for (const role of ROLES) for (const choice of roleChoices(role,packChoice(pack,role))) assert.notEqual(choice.model,'gpt-6-astra');
 const janitor=ROLES.find(r=>r.key==='janitor');
 assert.equal(janitor.service,true);
 assert.equal(janitor.default.effort,'low');
});


test('custom implementer on Claude gets compatible Codex security/final reserves',async()=>{
 const {resolveRoster}=await import('../src/presets.mjs');
 const chosen=Object.fromEntries(ROLES.map(r=>[r.key,r.default]));
 chosen.implementer={launcher:'claude',model:'claude-opus-5-5',effort:'medium'};
 chosen.review_security={launcher:'codex',model:'gpt-6.1-sol',effort:'medium'};
 chosen.review_final={launcher:'codex',model:'gpt-6.1-sol',effort:'medium'};
 const chains=resolveRoster(chosen);
 for(const role of ROLES) {
  assert.equal(chains[role.key].length,3);
  for(const c of chains[role.key])assert.deepEqual(checkIndependence({...chosen,[role.key]:c}),[]);
 }
 assert.ok(chains.review_security.every(c=>familyOf(c)!=='anthropic'));
});

test('preserved launch parsing rejects conflicting flags and understands equals syntax',async()=>{
 const {choiceFromLaunch}=await import('../src/presets.mjs');
 assert.equal(choiceFromLaunch('orca orchestration worker-start --agent=codex --model=gpt-6.1-sol').launcher,'codex');
 assert.equal(choiceFromLaunch('orca orchestration worker-start --agent codex --agent claude --model gpt-6.1-sol'),null);
 assert.equal(choiceFromLaunch('orca orchestration worker-start --agent codex --model gpt-6.1-sol; echo wrong'),null);
});
