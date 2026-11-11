const booleans=new Map([['--force','force'],['--skill-only','skillOnly'],['--help','help'],['-h','help'],['--version','version'],['-v','version']]);
const values=new Map([['--context-mode','enforcement'],['--skills-path','skillsPath']]);
export function cliOptions(args) {
  const result={command:'init'};let command=false;
  for(let i=0;i<args.length;i++) {
    const arg=args[i];
    if(arg==='--')continue;
    const eq=arg.indexOf('=');const key=eq<0?arg:arg.slice(0,eq);
    if(booleans.has(key)) {if(eq>=0)throw new Error(`${key} does not take a value`);result[booleans.get(key)]=true;continue;}
    if(values.has(key)) {
      const value=eq>=0?arg.slice(eq+1):args[++i];
      if(!value||value.startsWith('-'))throw new Error(`Missing value for ${key}`);
      result[values.get(key)]=value;continue;
    }
    if(arg.startsWith('-'))throw new Error(`Unknown option: ${arg}`);
    if(command)throw new Error(`Unexpected argument: ${arg}`);
    result.command=arg;command=true;
  }
  if(result.enforcement!==undefined&&!['enforced','instructed'].includes(result.enforcement))throw new Error('context mode must be enforced or instructed');
  if(!result.help&&!result.version) {
    if((result.skillOnly||result.skillsPath)&&result.command!=='upgrade')throw new Error('--skill-only and --skills-path require upgrade');
    if(result.enforcement&&result.command!=='upgrade'&&result.command!=='init')throw new Error('--context-mode requires init or upgrade');
  }
  return result;
}
