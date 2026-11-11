#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function reviewSettings(policy = {}) {
  const execution = policy.execution ?? 'batched';
  if (!['sequential', 'batched', 'parallel'].includes(execution)) throw new Error('review execution must be sequential, batched or parallel');
  if(execution === 'parallel' && policy.max_parallel != null)throw new Error('parallel runs all specialists; set max_parallel: null or use batched for a cap');
  const max_parallel = policy.max_parallel ?? 3;
  if (execution === 'batched' && (!Number.isSafeInteger(max_parallel) || max_parallel < 1)) throw new Error('batched max_parallel must be a positive integer');
  return { execution, max_parallel: execution === 'sequential' ? 1 : execution === 'parallel' ? null : max_parallel };
}

/** Only wave 8a specialists belong here; adjudication/attack keep their dependencies. */
export function reviewBatches({ roles, ...policy }) {
  if (!Array.isArray(roles) || roles.some(r => typeof r !== 'string' || !r.trim()) || new Set(roles).size !== roles.length) throw new Error('roles must be unique nonempty strings');
  if (roles.some(r => !['review_ui','review_performance','review_architecture','review_security','review_docs','review_tests','review_qa'].includes(r))) throw new Error('only specialist roles can be scheduled in wave 8a');
  const settings = reviewSettings(policy);
  const size = settings.max_parallel ?? Math.max(1, roles.length);
  const batches = [];
  for (let i = 0; i < roles.length; i += size) batches.push(roles.slice(i, i + size));
  return { ...settings, batches };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(reviewBatches(JSON.parse(readFileSync(process.argv[2] ?? 0, 'utf8'))))); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
