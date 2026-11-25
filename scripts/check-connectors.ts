import { discoverGateways, gatewayRequest, gatewayUrl, model, testTone } from '../src/server/gateway';
async function main() {
  const outside=process.argv.includes('--outside');
  const config=outside ? JSON.parse(await new Promise<string>(resolve=> {let text='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>text+=s);process.stdin.on('end',()=>resolve(text));})) : await discoverGateways();
  const anthropic=gatewayUrl(config.anthropic,'anthropic'), assemblyai=gatewayUrl(config.assemblyai,'assemblyai');
  const message={method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:16,output_config:{effort:'low'},messages:[{role:'user',content:'Reply with OK.'}]})};
  const upload={method:'POST',headers:{'Content-Type':'application/octet-stream'},body:new Uint8Array(testTone())};
  if(outside) {
    for(const [name,url,init] of [['model',anthropic+'/v1/messages',message],['listening',assemblyai+'/v2/upload',upload]] as const) {
      const response=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(30000)});
      if (![401,403].includes(response.status)) throw new Error(`${name}: expected refusal; received ${response.status}.`);
      console.log(`${name}: refused outside Sprite (${response.status})`);
    }
    return;
  }
  const answer=await gatewayRequest(anthropic,'/v1/messages',message);
  if(typeof answer.model !== 'string' || !answer.model.startsWith(model)) throw new Error('Model ping returned an unexpected model.');
  console.log(`Model: ${answer.model}`);
  const uploaded=await gatewayRequest(assemblyai,'/v2/upload',upload);
  if(typeof uploaded.upload_url !== 'string') throw new Error('Tone upload did not return an address.');
  const job=await gatewayRequest(assemblyai,'/v2/transcript',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio_url:uploaded.upload_url,speech_models:['assemblyai-stt-3-7']})});
  if(typeof job.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(job.id)) throw new Error('Transcription did not return a job.');
  try {
    for(let attempt=0;attempt<90;attempt++) {
      const result=await gatewayRequest(assemblyai,`/v2/transcript/${job.id}`);
      if(result.status==='completed') {console.log('Listening: two-second generated tone completed');return;}
      if(result.status==='error') throw new Error('Listening ping failed.');
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
    throw new Error('Listening ping timed out.');
  } finally {await gatewayRequest(assemblyai,`/v2/transcript/${job.id}`,{method:'DELETE'});}
}
main().catch(error=> {console.error(error instanceof Error ? error.message : 'Connector check failed.');process.exitCode=1;});
