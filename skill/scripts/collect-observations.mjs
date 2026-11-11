#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {cleanupPlan} from './cleanup-plan.mjs';

function command(program,args) {
  const result=spawnSync(program,args,{encoding:'utf8',timeout:10000,maxBuffer:2*1024*1024,shell:false});
  return {status:result.status,stdout:result.stdout??'',stderr:result.stderr??'',error:result.error?.message};
}
/** Execute on ONE explicit host only. No cleanup commands are issued. */
export function collectObservations(input,{host,run=command,now=()=>Date.now()}={}) {
  if(typeof host!=='string'||!host||!input||!Array.isArray(input.resources)||typeof input.runId!=='string')throw new Error('Explicit execution host, runId and resources are required');
  if(input.resources.filter(r=>r.host===host&&['worker','container'].includes(r.kind)).length>3)throw new Error('Collect at most 3 local resources per batch; plan immediately after collection');
  return {...input,resources:input.resources.map(resource=>{
    const r={...resource};
    if(r.host!==host) {delete r.observed;return r;}
    const base=()=>({id:r.id,host,measuredAt:new Date(now()).toISOString()});
    if(r.kind==='container') {
      if(!/^[a-f0-9]{64}$/.test(r.id??''))return {...r,observed:{...base(),source:'docker-inspect',error:'full immutable container ID required'}};
      const result=run('docker',['container','inspect',r.id]);
      if(result.status!==0) {
        const missing=/no such (object|container)/i.test(result.stderr);
        return {...r,observed:{...base(),source:'docker-inspect',...(missing?{exists:false}:{error:result.error||result.stderr||'inspect failed'})}};
      }
      try {
        const data=JSON.parse(result.stdout);
        if(!Array.isArray(data)||data.length!==1||data[0].Id!==r.id)throw new Error('inspect identity mismatch');
        const container=data[0],labels=container.Config?.Labels??{};
        return {...r,observed:{...base(),source:'docker-inspect',exists:true,state:container.State?.Status,runLabel:labels['dev.orca.issue-flow.run']??null,keepOpen:labels['dev.orca.issue-flow.keep']!=='false'}};
      } catch(error) {return {...r,observed:{...base(),source:'docker-inspect',error:error.message}};}
    }
    if(r.kind==='worker') {
      if(typeof r.id!=='string'||!r.id||r.id.startsWith('-'))return {...r,observed:{...base(),error:'invalid dispatch ID'}};
      const result=run('orca',['orchestration','worker-show','--dispatch',r.id,'--json','--full']);
      try {
        const receipt=JSON.parse(result.stdout);
        if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||result.status!==0||receipt.ok===false||receipt.error)throw new Error(receipt?.error?.message??result.error??'worker-show failed');
        return {...r,observed:{...base(),source:'orca-worker-show',commandOk:true,nativeRecord:receipt}};
      }catch(error) {return {...r,observed:{...base(),source:'orca-worker-show',commandOk:false,error:error.message}};}
    }
    // No portable PID-based ownership inference. Keep a caller-supplied observation only
    // when it was obtained by the registered supervisor and is still checked by the plan.
    return r;
  })};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const hostArg=process.argv.indexOf('--host');
    if(hostArg<0||!process.argv[hostArg+1])throw new Error('--host <exact-host-id> is required');
    const observed=collectObservations(JSON.parse(readFileSync(process.argv[2],'utf8')),{host:process.argv[hostArg+1]});
    console.log(JSON.stringify(process.argv.includes('--plan')?cleanupPlan(observed):observed));
  }catch(error){console.error(error.message);process.exitCode=2;}
}
