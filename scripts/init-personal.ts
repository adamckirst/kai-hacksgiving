import {mkdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openDatabase,seed} from '../src/server/db';
import {initializePersonal,personalInstance} from '../src/server/personal';
export function configurePersonal(state:string,origin:string,from:string){
 const url=new URL(origin);if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/' || !url.hostname.endsWith('.sprites.app'))throw Error('Use the HTTPS address of your own Sprite.');
 if(!/^[^\r\n]{1,254}@[^\r\n]{1,254}$/.test(from))throw Error('Use a verified Resend sending address.');
 if(existsSync(state+'/kai.sqlite') && !existsSync(state+'/personal-instance'))throw Error('Existing database has no personal-instance marker. Refusing to change it.');
 for(const [name,value] of [['public-url',url.origin],['mail-from',from]])if(existsSync(state+'/'+name) && readFileSync(state+'/'+name,'utf8').trim()!==value)throw Error('Existing personal configuration differs. Review it with the owner.');
 mkdirSync(state,{recursive:true,mode:0o700});const db=openDatabase(state+'/kai.sqlite');
 try{
  seed(db,new Date(),'public',false);const existing=personalInstance(db);const setup=existing?null:initializePersonal(db);
  for(const [name,value] of [['public-url',url.origin],['mail-from',from],['personal-instance','personal']])if(!existsSync(state+'/'+name))writeFileSync(state+'/'+name,value+'\n',{mode:0o600,flag:'wx'});
  return setup ? url.origin+'/setup#setup='+setup : null;
 }finally{db.close()}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const link=configurePersonal('/home/sprite/kai-state',process.argv[2]??'',process.argv[3]??'');if(link)process.stdout.write(link+'\n');else console.error('Personal instance already initialized; its owner and access are unchanged.');}
 catch{console.error('Personal setup could not finish. Check the empty-instance requirement, Sprite URL and verified sender. Existing notebooks were not replaced.');process.exitCode=1}
}
