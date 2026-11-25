export const model = 'claude-sonnet-5-5';
export function gatewayUrl(value:string,provider:string) {
  const url=new URL(value);
  if (url.origin !== 'https://api.sprites.dev' || url.username || url.password || url.search || url.hash || !new RegExp(`^/v1/gateway/${provider}/[a-zA-Z0-9_-]+/?$`).test(url.pathname)) throw new Error('Invalid connector gateway address.');
  return url.href.replace(/\/$/,'');
}
export async function discoverGateways() {
  const response=await fetch('https://api.sprites.dev/v1/gateway/list',{signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Gateway discovery refused (${response.status}). Run inside kai.`);
  const found:Record<string,string[]>={anthropic:[],assemblyai:[]};
  function visit(value:unknown) {
    if (typeof value==='string') for (const provider of Object.keys(found)) {
      try {const url=gatewayUrl(value,provider);if (!found[provider].includes(url)) found[provider].push(url);} catch {}
    }
    else if (value && typeof value==='object') Object.values(value).forEach(visit);
  }
  visit(await response.json());
  for (const provider of Object.keys(found)) if (found[provider].length !== 1) throw new Error(`Expected one accessible ${provider} connector; found ${found[provider].length}.`);
  return {anthropic:found.anthropic[0],assemblyai:found.assemblyai[0]};
}
export async function gatewayRequest(base:string,endpoint:string,init:RequestInit={}) {
  const response=await fetch(base+endpoint,{...init,redirect:'error',signal:init.signal ? AbortSignal.any([init.signal,AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Connector request failed (${response.status}).`);
  return response.json();
}
export function testTone() {
  const samples=32000, data=Buffer.alloc(44+samples*2);
  data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);
  data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(16000,24);data.writeUInt32LE(32000,28);
  data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++) data.writeInt16LE(Math.round(2000*Math.sin(2*Math.PI*440*i/16000)),44+i*2);
  return data;
}
