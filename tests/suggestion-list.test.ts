import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,seed} from '../src/server/db';
import {suggestionList} from '../src/server/suggestion-list';
import {decide} from '../src/server/decisions';

test('suggestions resolve their subject and task owner separately, within the notebook',()=>{
 const db=openDatabase();seed(db,new Date(),'first');seed(db,new Date(),'second');
 const add=db.prepare("INSERT INTO suggestions VALUES (?, 'first', 'first:dana-call', ?, ?, 'Invented quote', 'proposed')");
 try {
  add.run('note','note',JSON.stringify({person_id:'first:dana',text:'An invented note'}));
  add.run('task','todo',JSON.stringify({person_id:'first:dana',owner_person_id:'first:ellis',text:'An invented promise',due_on:null}));
  add.run('own','todo',JSON.stringify({person_id:null,owner_person_id:null,text:'Buy a notebook',due_on:null}));
  add.run('foreign','note',JSON.stringify({person_id:'second:dana',person_name:'A guessed name',text:'An invented invalid reference'}));
  const list=suggestionList(db,'first','first:dana-call');
  assert.equal(list.find(s=>s.id==='note')!.person_name,'Dana Whitfield');
  assert.equal(list.find(s=>s.id==='task')!.owner_name,'Ellis Rowan');
  assert.equal(list.find(s=>s.id==='task')!.person_name,'Dana Whitfield');
  assert.equal(list.find(s=>s.id==='own')!.person_name,null);assert.equal(list.find(s=>s.id==='own')!.owner_name,null);
  assert.equal(list.find(s=>s.id==='foreign')!.person_name,null);
  assert.deepEqual(suggestionList(db,'second','first:dana-call'),[]);
 }finally{db.close()}
});

test('new people are named before acceptance and kept promises retain their text after acceptance',()=>{
 const db=openDatabase();seed(db,new Date(),'first');
 const add=db.prepare("INSERT INTO suggestions VALUES (?, 'first', 'first:dana-call', ?, ?, 'Invented quote', 'proposed')");
 try {
  add.run('proposed','person',JSON.stringify({name:'Sora Bell',company:'Cloudberry Smiles',role:'Manager'}));
  add.run('new-note','note',JSON.stringify({person_id:'proposed',text:'An invented note'}));
  add.run('kept','done',JSON.stringify({person_id:'first:dana',todo_id:'first:pricing',text:'Send Dana the pricing'}));
  assert.equal(suggestionList(db,'first','first:dana-call').find(s=>s.id==='new-note')!.person_name,'Sora Bell');
  decide(db,'first','proposed','accept',{name:'Sora Fern'});decide(db,'first','kept','accept');
  const list=suggestionList(db,'first','first:dana-call');
  assert.equal(list.find(s=>s.id==='new-note')!.person_name,'Sora Fern');
  assert.equal(list.find(s=>s.id==='kept')!.todo_text,'Send Dana the pricing');
  assert.equal(list.find(s=>s.id==='kept')!.person_name,'Dana Whitfield');
  assert.equal(list.find(s=>s.id==='kept')!.status,'accepted');
 }finally{db.close()}
});
