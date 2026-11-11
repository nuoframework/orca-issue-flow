#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {posix} from 'node:path';
const digest = value => typeof value==='string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const text = value => typeof value==='string' && !!value.trim();
const paths = value => {
  if(!Array.isArray(value))return null;
  const result=[];
  for(const p of value) {
    if(!text(p)||p.startsWith('/')||p.endsWith('/')||p.split('/').includes('..')||/[?*\\\0]/.test(p))return null;
    const normalized=posix.normalize(p);
    if(normalized==='.'||normalized==='')return null;
    result.push(normalized);
  }
  return result;
};

/** Validate a recorded, evidence-backed unaffected-scope attestation. Not author auth. */
export function carryReview(report,change) {
  const fail=reason=>({allowed:false,reason});
  if(!report||!change||report.verdict!=='approve')return fail('only an approved report can carry');
  if(['review_final','review_adversarial'].includes(report.role))return fail('final critics must rerun');
  if(!digest(report.reviewedHead)||!digest(change.fromHead)||!digest(change.toHead)||report.reviewedHead!==change.fromHead)return fail('revision mismatch');
  if(report.criteriaHash!==change.criteriaHash||report.verdictHash!==change.verdictHash||!digest(change.criteriaHash)||!digest(change.verdictHash))return fail('criteria/verdict changed or missing');
  const scope=report.scope;
  if(!scope||scope.complete!==true||!paths(scope.files)||!scope.files.length||!paths(scope.dependencies))return fail('complete concrete scope and dependencies required');
  if(!paths(change.changedPaths)||!text(change.diffEvidence)||!text(change.attestation?.by)||!text(change.attestation?.evidence)||!text(change.attestation?.reason))return fail('diff and unaffected-scope attestation required');
  const covered=[...paths(scope.files),...paths(scope.dependencies)];
  if(paths(change.changedPaths).some(p=>covered.some(s=>p===s||p.startsWith(s+'/')||s.startsWith(p+'/'))))return fail('reviewed scope or dependencies changed');
  return {allowed:true,reviewedHead:report.reviewedHead,validatedForHead:change.toHead,evidence:change.attestation.evidence};
}

/** The caller must populate gate/owner receipts from real observations, not model claims. */
export function deliveryState(input) {
  const blocked=reason=>({status:'blocked',reason,pending:[]});
  if(!input||!digest(input.head)||!digest(input.criteriaHash)||!digest(input.verdictHash))return blocked('current revision and criteria/verdict digests required');
  if(input.verifyGreen!==true||!text(input.gateEvidence))return blocked('deterministic gates must pass for current revision');
  const context=input.context;
  if(!context||!['enforced','instructed'].includes(context.enforcement))return blocked('context mode missing');
  if(context.enforcement==='enforced'&&(context.adapterVerified!==true||context.breaches!==0))return blocked('strict context enforcement unavailable or breached');
  if(context.enforcement==='instructed'&&(context.explicitOptIn!==true||context.disclosed!==true))return blocked('instructed mode needs explicit opt-in and disclosure');
  if(!Array.isArray(input.requiredRoles)||!Array.isArray(input.reports)||!Array.isArray(input.findings))return blocked('required roles, reports and findings must be arrays');
  const identities=new Set();
  for(const report of input.reports) {
    if(!report||typeof report!=='object')return blocked('invalid report');
    const id=`${report.role}:${report.reviewedHead}`;
    if(identities.has(id))return blocked('duplicate report for role/revision; select one authoritative report');
    identities.add(id);
  }
  const pending=[];
  for(const role of input.requiredRoles) {
    if(!text(role))return blocked('invalid required role');
    const matching=input.reports.filter(r=>r.role===role&&r.criteriaHash===input.criteriaHash&&r.verdictHash===input.verdictHash);
    const current=matching.find(r=>r.reviewedHead===input.head);
    const carried=current?[]:matching.filter(r=>r.carry?.toHead===input.head&&carryReview(r,r.carry).allowed);
    if(carried.length>1)return blocked('multiple carried reports; select one authoritative report');
    const report=current??carried[0];
    if(!report||report.verdict!=='approve'||report.coverageComplete!==true)pending.push(`coverage:${role}`);
  }
  for(const finding of input.findings) {
    if(!text(finding.id)||!['BLOCKS','SHOULD','COULD'].includes(finding.severity))return blocked('invalid finding');
    if(finding.severity==='COULD')continue;
    const resolved=['fixed','refuted'].includes(finding.status)&&finding.resolvedAtHead===input.head&&text(finding.evidence);
    if(!resolved)pending.push(finding.id);
  }
  const acceptance=input.ownerAcceptance;
  const accepted=acceptance?.explicit===true&&acceptance.head===input.head&&acceptance.criteriaHash===input.criteriaHash&&acceptance.verdictHash===input.verdictHash&&text(acceptance.source)&&text(acceptance.reason)&&Array.isArray(acceptance.ids)?new Set(acceptance.ids):new Set();
  const remaining=[...new Set(pending)].filter(id=>!accepted.has(id));
  if(remaining.length)return {status:'needs_owner_decision',pending:remaining};
  const risks=[...new Set(pending)].filter(id=>accepted.has(id));
  return {status:risks.length?'ready_with_accepted_risks':'ready',pending:[],acceptedRisks:risks};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {const result=deliveryState(JSON.parse(readFileSync(process.argv[2]??0,'utf8')));console.log(JSON.stringify(result));process.exitCode=result.status.startsWith('ready')?0:2;}
  catch(error){console.error(error.message);process.exitCode=2;}
}
