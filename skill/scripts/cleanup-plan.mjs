#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Makes a plan from a run ledger plus fresh runtime observations. Never executes it.
 * The janitor must collect live facts; this function does not authenticate attestations.
 */
export function cleanupPlan(input, now = Date.now()) {
  if (!input || typeof input.runId !== 'string' || !input.runId || !Array.isArray(input.resources) || !Array.isArray(input.settledTasks) || input.settledTasks.some(t=>typeof t!=='string')) throw new Error('runId, resources and settledTasks are required');
  if (input.finalizeRun !== undefined && typeof input.finalizeRun !== 'boolean') throw new Error('finalizeRun must be boolean');
  const settled = new Set(input.settledTasks);
  const actions = [], retained = [], completed = [];
  const seen = new Set();
  for (const r of input.resources) {
    const retain = reason => retained.push({ kind:r?.kind, id:r?.id, host:r?.host, reason });
    if (!r || typeof r !== 'object' || !['container','worker','process'].includes(r.kind) || typeof r.id !== 'string' || !r.id || typeof r.host !== 'string' || !r.host) { retain('invalid identity'); continue; }
    const identity = `${r.host}:${r.kind}:${r.id}`;
    if (seen.has(identity)) { retain('duplicate identity'); continue; }
    seen.add(identity);
    const live = r.observed;
    const measured = Date.parse(live?.measuredAt);
    if (!live || !Number.isFinite(measured) || measured > now || now - measured > 60000 || live.host !== r.host || live.id !== r.id) { retain('missing, stale or mismatched runtime observation'); continue; }
    if (r.ownerRunId !== input.runId || r.createdByRun !== true || (typeof r.creationReceipt !== 'string' || !r.creationReceipt.trim())) { retain('ownership unproven or foreign run'); continue; }
    if (r.ephemeral !== true || r.keepOpen !== false) { retain('persistent, user-kept or preservation state unknown'); continue; }
    if (r.retainUntilRunEnd !== false && !input.finalizeRun) { retain('still reserved until run end'); continue; }
    if (!Array.isArray(r.consumers) || r.consumers.length === 0 || r.consumers.some(t=>typeof t!=='string'||!settled.has(t))) { retain('active or unproven consumers'); continue; }
    if (r.kind === 'container') {
      if (live.error || live.source !== 'docker-inspect') { retain('fresh Docker observation required'); continue; }
      if (live.exists === false && live.state && live.state !== 'absent') { retain('contradictory container existence/state'); continue; }
      if (/^[a-f0-9]{64}$/.test(r.id) && live.exists === false) { completed.push({kind:r.kind,id:r.id,host:r.host,state:'absent'}); continue; }
      if (!/^[a-f0-9]{64}$/.test(r.id) || live.keepOpen !== false || live.runLabel !== input.runId || !['running','exited','created','dead'].includes(live.state)) { retain('container identity, label or state unproven'); continue; }
      actions.push({kind:r.kind,id:r.id,host:r.host,action:live.state==='running'?'stop_and_remove_container':'remove_container',executor:'janitor'});
    } else if (r.kind === 'worker') {
      if (live.source === 'orca-worker-show') {
        if (live.commandOk !== true || !live.nativeRecord || live.error) {retain('worker observation unavailable');continue;}
        // Native Orca release is the authoritative custody/keep-open/state check. This
        // is only a request to its guarded operation, never proof of eligibility/exit.
        actions.push({kind:r.kind,id:r.id,host:r.host,action:'request_guarded_worker_release',executor:'coordinator'});
        continue;
      }
      if (live.source !== 'orca-normalized' || live.ownerRunId !== input.runId || live.keepOpen !== false) {retain('native worker receipt required');continue;}
      if (['released','already_released'].includes(live.releaseState) && ['succeeded','failed','cancelled'].includes(live.dispatchState)) { completed.push({kind:r.kind,id:r.id,host:r.host,state:live.releaseState}); continue; }
      if (['retained','release_unknown','release_pending'].includes(live.releaseState)) { retain('worker release is retained, pending or unknown; follow its runtime receipt'); continue; }
      if (!['succeeded','failed','cancelled'].includes(live.dispatchState) || live.releaseEligible !== true || live.coordinatorOwned !== true) { retain('unsettled, retained or unverifiable worker'); continue; }
      actions.push({kind:r.kind,id:r.id,host:r.host,action:'release_worker',executor:'coordinator'});
    } else {
      if (live.ownerRunId !== input.runId || live.keepOpen !== false) {retain('supervisor ownership or preservation unproven');continue;}
      if (!r.supervisorId || live.supervisorId !== r.supervisorId || !r.startToken || live.startToken !== r.startToken || live.supervisorOwned !== true || !['running','exited'].includes(live.state)) { retain('process requires matching supervisor and start identity; raw PID is insufficient'); continue; }
      if (live.state === 'exited') { completed.push({kind:r.kind,id:r.id,host:r.host,state:'exited'}); continue; }
      actions.push({kind:r.kind,id:r.id,host:r.host,supervisorId:r.supervisorId,action:'stop_via_supervisor',executor:'janitor'});
    }
  }
  // Do not act on an identity if the same batch contains conflicting ledger entries.
  const duplicates = new Set(retained.filter(r=>r.reason==='duplicate identity').map(r=>`${r.host}:${r.kind}:${r.id}`));
  const safeActions = actions.filter(a=>!duplicates.has(`${a.host}:${a.kind}:${a.id}`));
  return { runId:input.runId, actions:safeActions, completed:completed.filter(r=>!duplicates.has(`${r.host}:${r.kind}:${r.id}`)), retained };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(cleanupPlan(JSON.parse(readFileSync(process.argv[2] ?? 0,'utf8'))))); }
  catch(error) { console.error(error.message); process.exitCode=2; }
}
