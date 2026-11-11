import {existsSync,mkdirSync,mkdtempSync,readFileSync,renameSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {replaceRoles} from './project-config.mjs';
import {ensureRunExclude} from './run-exclude.mjs';

export function writeRoles(root,expected,roles) {
  const path=join(root,'.orca-flow.yml');
  if(readFileSync(path,'utf8')!==expected)throw new Error('Configuration changed during the wizard; retry without overwriting those edits');
  const next=replaceRoles(expected,roles),pending=path+'.pending';
  const mode=statSync(path).mode&0o777;
  writeFileSync(pending,next,{flag:'wx',mode});
  try {
    if(readFileSync(path,'utf8')!==expected)throw new Error('Configuration changed before write; no settings replaced');
    ensureRunExclude(root);
    const run=join(root,'.orca-run');mkdirSync(run,{recursive:true});
    const backup=join(mkdtempSync(join(run,'roles-')),'.orca-flow.yml');
    writeFileSync(backup,expected,{mode});
    renameSync(pending,path);
    return backup;
  }catch(error){if(existsSync(pending))rmSync(pending,{force:true});throw error;}
}
