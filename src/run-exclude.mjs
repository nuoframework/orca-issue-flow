import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

/** Ignore run artifacts locally without changing any tracked worktree file. */
export function ensureRunExclude(root) {
  let path;
  try {path=execFileSync('git',['rev-parse','--git-path','info/exclude'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
  catch {return false;}
  const target=resolve(root,path);
  const original=existsSync(target)?readFileSync(target,'utf8'):'';
  if(original.split(/\r?\n/).includes('.orca-run/'))return false;
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,original+(original && !original.endsWith('\n')?'\n':'')+'.orca-run/\n');
  return true;
}
