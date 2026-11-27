import {quotaEmail} from '../email/quota';
import type {SendQuota} from './quota-mail';
import {readyEmail} from '../email/ready';
import {failedEmail} from '../email/failed';
import {gatewayUrl,gatewayRequest} from './gateway';
import type {SendCode} from './trial';
import type {ReadyCounts,SendReady} from './recording-mail';
async function sendMail(from:string,email:string,id:string,subject:string,text:string,html?:string) {
 const response=await fetch('https://api.sprites.dev/v1/gateway/list',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Mail connector unavailable.');
 const found=new Set<string>();
 function visit(value:unknown) {
  if(typeof value==='string'){try{found.add(gatewayUrl(value,'resend'));}catch{}}
  else if(value && typeof value==='object')Object.values(value).forEach(visit);
 }
 visit(await response.json());
 if(found.size!==1)throw new Error('Expected one mail connector.');
 await gatewayRequest([...found][0],'/emails',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from,to:[email],subject,text,...(html ? {html}:{})})});
}
export function resendSender(from:string):SendCode {
 return (email,code,id)=>sendMail(from,email,'kai-verification-'+id,'Your KAI verification code',`Your KAI verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`);
}
export function readyMessage(origin:string,id:string,counts:ReadyCounts,title?:string) {
 return readyEmail(origin,id,counts,title).text;
}
export function resendReadySender(from:string,origin:string):SendReady {
 // Validate configuration before starting the worker; never derive links from request headers.
 readyMessage(origin,'check',{person:0,note:0,todo:0,done:0});
 return (email,id,counts,title,kind='ready')=>{const message=kind==='failed'?failedEmail(origin,id):readyEmail(origin,id,counts,title);return sendMail(from,email,'kai-recording-'+kind+'-'+id,message.subject,message.text,message.html);};
}

export function resendQuotaSender(from:string,origin:string):SendQuota {
 quotaEmail(origin,1,0);return (email,id,requested,remaining)=>{const message=quotaEmail(origin,requested,remaining);return sendMail(from,email,'kai-quota-'+id,message.subject,message.text,message.html)};
}
