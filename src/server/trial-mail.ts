import {gatewayUrl,gatewayRequest} from './gateway';
import type {SendCode} from './trial';
export function resendSender(from:string):SendCode {
 return async(email,code,id)=>{
  const response=await fetch('https://api.sprites.dev/v1/gateway/list',{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Mail connector unavailable.');
  const found=new Set<string>();
  function visit(value:unknown) {
   if(typeof value==='string'){try{found.add(gatewayUrl(value,'resend'));}catch{}}
   else if(value && typeof value==='object')Object.values(value).forEach(visit);
  }
  visit(await response.json());
  if(found.size!==1)throw new Error('Expected one mail connector.');
  await gatewayRequest([...found][0],'/emails',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'kai-verification-'+id},body:JSON.stringify({from,to:[email],subject:'Your KAI verification code',text:`Your KAI verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`})});
 };
}
