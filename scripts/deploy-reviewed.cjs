const hook=process.env.RENDER_DEPLOY_HOOK_URL;
const sha=process.env.RELEASE_SHA;
if(!hook || !/^[a-f0-9]{40}$/.test(sha||''))throw new Error('Configure deploy hook and exact release SHA');
const url=new URL(hook);if(url.protocol!=='https:')throw new Error('Deploy hook must use HTTPS');
url.searchParams.set('ref',sha);
fetch(url,{method:'POST',signal:AbortSignal.timeout(30000)}).then(r=>{if(!r.ok)throw new Error('Deploy request failed: '+r.status);}).catch(()=>{console.error('Deploy request failed; verify the hook in your secret manager.');process.exitCode=1;});
