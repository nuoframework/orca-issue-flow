import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from './detect.mjs';
import { ensureRunExclude } from './run-exclude.mjs';
import { readConfig, migrateConfig } from './project-config.mjs';

const PKG_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const NAME='orca-issue-flow';
export function skillTargets(root, source, explicit) {
  const doc=readConfig(source);
  const configured=doc.toJS().skill_directories;
  if (configured !== undefined && (!Array.isArray(configured) || configured.some(p=>typeof p!=='string'))) throw new Error('skill_directories must be an array of paths');
  const dirs=[...(explicit?[explicit]:[]),...(configured??[]),'.agents/skills','.claude/skills'];
  const found=[...new Set(dirs.map(p=>resolve(root,p,NAME)))].filter(p=>(explicit && resolve(root,explicit,NAME)===p) || configured?.some(d=>resolve(root,d,NAME)===p) || existsSync(join(p,'SKILL.md')));
  return found.length ? found : [join(root,'.agents/skills',NAME)];
}
export function upgradeProject(root,{skillOnly=false,enforcement,skillsPath}={}) {
  if(skillOnly && enforcement!==undefined)throw new Error('--skill-only cannot change context mode');
  const configPath=join(root,'.orca-flow.yml');
  if (!existsSync(configPath)) throw new Error('No .orca-flow.yml found; run init first');
  if(lstatSync(configPath).isSymbolicLink())throw new Error('Refusing to replace a symlink configuration; migrate its real target explicitly');
  const original=readFileSync(configPath,'utf8');
  const configMode=statSync(configPath).mode & 0o777;
  const targets=skillTargets(root,original,skillsPath);
  for (const target of targets) {
    if (lstatSafe(target)?.isSymbolicLink()) throw new Error(`Refusing to replace symlink skill target: ${target}`);
    const ancestor=targets.find(other=>other!==target && target.startsWith(other+'/'));
    if (ancestor) throw new Error('Overlapping skill targets are not supported');
    if (existsSync(target)) {
      const old=join(target,'SKILL.md');
      if (!existsSync(old) || !/^name:\s*orca-issue-flow\s*$/m.test(readFileSync(old,'utf8'))) throw new Error(`Skill target is not owned by ${NAME}: ${target}`);
    }
  }
  const originalDirectories=readConfig(original).toJS().skill_directories??[];
  const directories=[...originalDirectories];
  const known=new Set(directories.map(d=>resolve(root,d)));
  for(const target of targets)if(!known.has(dirname(target))) {directories.push(explicitDirectory(root,dirname(target),skillsPath));known.add(dirname(target));}
  const migration=skillOnly ? {source:original,warnings:['Skill-only upgrade preserved configuration. Run upgrade to migrate missing schema fields.']} : migrateConfig(original,{enforcement,skillDirectories:directories});
  ensureRunExclude(root);
  const backupRoot=join(root,'.orca-run');mkdirSync(backupRoot,{recursive:true});
  const backup=mkdtempSync(join(backupRoot,'upgrade-'));
  writeFileSync(join(backup,'.orca-flow.yml'),original);
  const changes=[];
  try {
    for (const [i,target] of targets.entries()) {
      mkdirSync(dirname(target),{recursive:true});
      const stage=mkdtempSync(join(dirname(target),'.orca-flow-stage-'));
      changes.push({target,stage,saved:join(backup,`skill-${i}`),hadOriginal:existsSync(target),replaced:false});
      cpSync(join(PKG_ROOT,'skill'),stage,{recursive:true});
    }
    for (const item of changes) {
      if(item.hadOriginal) renameSync(item.target,item.saved);
      try { renameSync(item.stage,item.target);item.replaced=true; }
      catch(error) { if(item.hadOriginal) renameSync(item.saved,item.target);throw error; }
    }
    if (!skillOnly) {
      const pending=join(root,'.orca-flow.yml.pending');
      // Exclusive create avoids overwriting another operation's pending file.
      writeFileSync(pending,migration.source,{flag:'wx',mode:configMode});
      try {renameSync(pending,configPath);} catch(error) {rmSync(pending,{force:true});throw error;}
    }
  } catch(error) {
    for (const item of [...changes].reverse()) {
      if(item.replaced) {rmSync(item.target,{recursive:true,force:true});if(item.hadOriginal)renameSync(item.saved,item.target);}
      if(existsSync(item.stage))rmSync(item.stage,{recursive:true,force:true});
    }
    throw error;
  }
  return {targets,backup,warnings:migration.warnings};
}
function explicitDirectory(root,path,explicit) {return explicit && resolve(root,explicit)===path ? explicit : relative(root,path);}
function lstatSafe(path) { try{return lstatSync(path);}catch(e){if(e.code==='ENOENT')return null;throw e;} }
export async function upgrade(options={}) {
  const root=repoRoot()??process.cwd();
  const result=upgradeProject(root,options);
  console.log(`Updated skill(s): ${result.targets.map(p=>relative(root,p)).join(', ')}`);
  console.log(`Backup: ${result.backup}`);
  for(const warning of result.warnings)console.warn(warning);
}
