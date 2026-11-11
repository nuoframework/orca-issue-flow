import { isMap, isSeq, parseDocument } from 'yaml';
import { ROLES, buildLaunch, resolveRoster, choiceFromLaunch, checkIndependence } from './presets.mjs';
import { renderRolesSection } from './config.mjs';
import {reviewSettings} from '../skill/scripts/review-batches.mjs';

export const SCHEMA_VERSION = 2;
export const CONTEXT_MODES = ['enforced', 'instructed'];
export function contextMode(value = 'enforced') {
  if (!CONTEXT_MODES.includes(value)) throw new Error('context mode must be enforced or instructed');
  return value;
}
export function readConfig(source) {
  const doc = parseDocument(source);
  if (doc.errors.length) throw new Error(`Invalid configuration: ${doc.errors.map(e=>e.message).join('; ')}`);
  if (!isMap(doc.contents)) throw new Error('Configuration must be a YAML mapping');
  doc.toJS(); // Refuse unresolved aliases before any rewrite.
  return doc;
}
export function installedRoles(choices = Object.fromEntries(ROLES.map(r=>[r.key,r.default]))) {
  const chains=resolveRoster(choices);
  return ROLES.map(role=>{
    const [a,b,c] = chains[role.key];
    return { key:role.key, label:role.label, launch:buildLaunch(a), fallback:buildLaunch(b), fallback_2:buildLaunch(c) };
  });
}

/** Replace just the roles mapping; preserve surrounding bytes, comments and later keys. */
export function replaceRoles(source, roles) {
  const doc = readConfig(source);
  const pair = doc.contents.items.find(p=>p.key?.value === 'roles');
  if (!pair || !isMap(pair.value) || !pair.key.range || !pair.value.range) throw new Error('Expected a roles mapping; run upgrade before reconfiguring');
  const rendered = renderRolesSection({roles});
  let body = rendered.slice(rendered.indexOf('roles:\n'));
  if(pair.value.anchor)body=body.replace('roles:\n',`roles: &${pair.value.anchor}\n`);
  const result=source.slice(0,pair.key.range[0]) + body + source.slice(pair.value.range[2]);
  readConfig(result);
  return result;
}

/** Add missing schema fields only. Existing user values and comments are retained. */
export function migrateConfig(source, { enforcement, skillDirectories } = {}) {
  const doc = readConfig(source);
  const version = doc.get('schema_version');
  if (version !== undefined && (!Number.isInteger(version) || version > SCHEMA_VERSION || version < 1)) throw new Error('Unsupported configuration schema version');
  const add = (path,value) => { if (!doc.hasIn(path)) doc.setIn(path,value); };
  for (const key of ['context','review_policy','cleanup','roles']) {
    if (doc.has(key) && !isMap(doc.get(key,true))) throw new Error(`${key} must be a YAML mapping`);
  }
  doc.set('schema_version',SCHEMA_VERSION);
  if (enforcement !== undefined) doc.setIn(['context','enforcement'],contextMode(enforcement));
  add(['context','enforcement'],'enforced');
  contextMode(doc.getIn(['context','enforcement']));
  for (const [key,value] of Object.entries({max_window_percent:60,handoff_at_percent:50,max_tool_output_tokens:4000,max_packet_tokens:12000,digest_gate_logs_over:200,raw_log_after_rounds:2})) add(['context',key],value);
  for (const [key,value] of Object.entries({mode:'critical_specialists',family_policy:'native_priority',execution:'batched',adversarial:'always',require_evidence:true})) add(['review_policy',key],value);
  const execution=doc.getIn(['review_policy','execution']);
  add(['review_policy','max_parallel'],execution==='parallel'?null:execution==='sequential'?1:3);
  reviewSettings(doc.toJS().review_policy); // Validate migration output before writing.
  for (const [key,value] of Object.entries({enabled:true,after_each_phase:true,on_run_exit:true,remove_volumes:false})) add(['cleanup',key],value);
  for (const r of installedRoles()) {
    const {key,...fields} = r;
    if (doc.hasIn(['roles',key]) && !isMap(doc.getIn(['roles',key],true))) throw new Error(`roles.${key} must be a mapping`);
    for (const [name,value] of Object.entries(fields)) add(['roles',key,name],value);
  }
  if (skillDirectories?.length) {
    if(!doc.has('skill_directories'))doc.set('skill_directories',skillDirectories);
    else {
      if(!isSeq(doc.get('skill_directories',true)))throw new Error('skill_directories must be an array');
      const existing=new Set(doc.toJS().skill_directories);
      for(const path of skillDirectories)if(!existing.has(path)){doc.addIn(['skill_directories'],path);existing.add(path);}
    }
  }
  const warnings = [];
  const roles = doc.get('roles',true);
  for (const key of ['review_light_1','review_light_2','review_deep']) if (roles.has(key)) warnings.push(`Legacy role ${key} preserved but ignored; use roles to repick the roster.`);
  for (const r of ROLES) if (!String(doc.getIn(['roles',r.key,'launch']) ?? '').startsWith('orca orchestration worker-start')) warnings.push(`${r.key} has a legacy/custom launcher; repick it with roles before running.`);
  for(const [key,expected] of [['max_window_percent',60],['handoff_at_percent',50]])if(doc.getIn(['context',key])!==expected)warnings.push(`context.${key}=${doc.getIn(['context',key])} was preserved; correct it to ${expected} before running.`);
  const chosen={};
  let unresolved=false;
  for(const role of ROLES) {
    chosen[role.key]=choiceFromLaunch(doc.getIn(['roles',role.key,'launch']));
    if(!chosen[role.key]&&!role.service)unresolved=true;
  }
  const rosterProblems=unresolved?['Cannot verify every phase launcher/model.']:checkIndependence(chosen);
  if(!unresolved)for(const role of ROLES)for(const field of ['fallback','fallback_2']) {
    const command=doc.getIn(['roles',role.key,field]);
    if(command==null)continue;
    const candidate=choiceFromLaunch(command);
    if(!candidate&&!role.service)rosterProblems.push(`${role.key}.${field} is not verifiable.`);
    else if(candidate)for(const reason of checkIndependence({...chosen,[role.key]:candidate}))rosterProblems.push(`${role.key}.${field}: ${reason}`);
  }
  if(rosterProblems.length) {
    doc.setIn(['roles','__requires_review'],true);
    warnings.push(...rosterProblems.map(message=>`BLOCKING roster review: ${message} Run roles before starting any workflow.`));
  }else doc.deleteIn(['roles','__requires_review']);
  if (doc.getIn(['context','enforcement']) === 'enforced') warnings.push('Strict 60% mode still requires an external runtime admission adapter; no adapter is installed by upgrade.');
  return { source:doc.toString(), warnings, schemaVersion:SCHEMA_VERSION };
}
