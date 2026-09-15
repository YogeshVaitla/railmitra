const {setTimeout:wait}=require('node:timers/promises');
const url=process.env.HEALTH_URL,sha=process.env.RELEASE_SHA;
if(!url?.startsWith('https://') || !/^[a-f0-9]{40}$/.test(sha||''))throw new Error('Set HTTPS health URL and exact release SHA');
(async()=>{
  for(let attempt=0;attempt<30;attempt++){
    try {const r=await fetch(url,{signal:AbortSignal.timeout(10000)});const body=await r.json();if(r.ok&&body.status==='ok'&&body.protocol===2&&body.version===sha){console.log('Exact release is healthy');return;}}catch{}
    await wait(10000);
  }
  throw new Error('Expected release never became healthy');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
