import {gatewayUrl,gatewayRequest} from './gateway';
import type {SendCode} from './trial';
import type {ReadyCounts,SendReady} from './recording-mail';
async function sendMail(from:string,email:string,id:string,subject:string,text:string) {
 const response=await fetch('https://api.sprites.dev/v1/gateway/list',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Mail connector unavailable.');
 const found=new Set<string>();
 function visit(value:unknown) {
  if(typeof value==='string'){try{found.add(gatewayUrl(value,'resend'));}catch{}}
  else if(value && typeof value==='object')Object.values(value).forEach(visit);
 }
 visit(await response.json());
 if(found.size!==1)throw new Error('Expected one mail connector.');
 await gatewayRequest([...found][0],'/emails',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from,to:[email],subject,text})});
}
export function resendSender(from:string):SendCode {
 return (email,code,id)=>sendMail(from,email,'kai-verification-'+id,'Your KAI verification code',`Your KAI verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`);
}
export function readyMessage(origin:string,id:string,counts:ReadyCounts) {
 const url=new URL(origin);
 if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/')throw new Error('A public HTTPS origin is required for recording mail.');
 const items=[`${counts.person} suggested ${counts.person===1?'person':'people'}`,`${counts.note} suggested ${counts.note===1?'note':'notes'}`,`${counts.todo} suggested ${counts.todo===1?'to-do':'to-dos'}`,`${counts.done} ${counts.done===1?'promise':'promises'} that may be done`];
 const hasSuggestions=Object.values(counts).some(n=>n>0);
 return `Hi there,\n\nI've finished transcribing and summarizing your recording.\n\n${hasSuggestions ? "Here's what I found for you to review:\n"+items.map(s=>'• '+s).join('\n') : 'There are no new suggestions waiting. Your transcript and summary are ready to read.'}\n\nYou decide what to keep in KAI.\n\nReview in KAI: ${new URL('/recordings/'+encodeURIComponent(id),url).href}\n\nOpen this link in the browser where you started your notebook.\n\nSee you there,\nKAI, by Kopal`;
}
export function resendReadySender(from:string,origin:string):SendReady {
 // Validate configuration before starting the worker; never derive links from request headers.
 readyMessage(origin,'check',{person:0,note:0,todo:0,done:0});
 return (email,id,counts)=>sendMail(from,email,'kai-recording-ready-'+id,'Your recording is ready — KAI',readyMessage(origin,id,counts));
}
