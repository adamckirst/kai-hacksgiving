export const samples = [
  {id:'dana',title:'A follow-up with Dana',text:'I spoke with Dana Whitfield at Willow Dental. She thanked me for the pricing I sent Monday. Her CFO wants to review security. I promised to send the security questionnaire by Thursday. Dana promised to introduce me to her CFO.'},
  {id:'ellis',title:'Trial plans with Ellis',text:'Ellis Rowan at Harbour Dental wants to try Loomwork with two receptionists. I promised to send a trial checklist tomorrow. Ellis will send the trial dates next week.'},
  {id:'sora',title:'Meeting Sora',text:'I met Sora Bell, the clinic manager at Cloudberry Smiles. Sora wants scheduling that leaves room for urgent appointments. I promised to send Sora a short overview tomorrow.'},
] as const;
export function dateAfter(day:string,offset:number) {const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}
export function nextThursday(day:string) {return dateAfter(day,(4-new Date(day+'T12:00:00Z').getUTCDay()+7)%7);}
