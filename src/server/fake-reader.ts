import { samples, dateAfter, nextThursday } from '../samples';
import type { Reader } from './reading';
export const fakeReader:Reader=async(input,call)=> {
  const sample=samples.find(s=>s.text===input.text);
  call('describe_recording',{title:sample?.title ?? 'A new conversation',summary:sample ? 'KAI found people and promises in these words.\nReview the suggestions below.' : 'KAI kept these words.\nThe local practice reader has no suggestions for this text.'});
  const person=(name:string)=>input.people.find(p=>p.name===name)!.id;
  if(sample?.id==='dana') {
    const id=person('Dana Whitfield');
    call('propose_note',{person_id:id,text:'Her CFO wants to review security.',quote:'Her CFO wants to review security.'});
    call('propose_todo',{person_id:id,owner_person_id:null,text:'Send the security questionnaire',due_on:nextThursday(input.happened_on),quote:'I promised to send the security questionnaire by Thursday.'});
    call('propose_todo',{person_id:id,owner_person_id:id,text:'Introduce Mara to the CFO',due_on:null,quote:'Dana promised to introduce me to her CFO.'});
  } else if(sample?.id==='ellis') {
    const id=person('Ellis Rowan');
    call('propose_note',{person_id:id,text:'Wants a trial with two receptionists.',quote:'Ellis Rowan at Harbour Dental wants to try Loomwork with two receptionists.'});
    call('propose_todo',{person_id:id,owner_person_id:null,text:'Send a trial checklist',due_on:dateAfter(input.happened_on,1),quote:'I promised to send a trial checklist tomorrow.'});
    call('propose_todo',{person_id:id,owner_person_id:id,text:'Send the trial dates',due_on:dateAfter(input.happened_on,7),quote:'Ellis will send the trial dates next week.'});
  } else if(sample?.id==='sora') {
    const result=call('propose_person',{name:'Sora Bell',company:'Cloudberry Smiles',role:'Clinic manager',quote:'I met Sora Bell, the clinic manager at Cloudberry Smiles.'});
    call('propose_note',{person_id:result.id,text:'Needs room for urgent appointments.',quote:'Sora wants scheduling that leaves room for urgent appointments.'});
    call('propose_todo',{person_id:result.id,owner_person_id:null,text:'Send Sora a short overview',due_on:dateAfter(input.happened_on,1),quote:'I promised to send Sora a short overview tomorrow.'});
  }
};
