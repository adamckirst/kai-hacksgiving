import {useEffect,useState} from 'react';
import type {RecordingItem} from './look/types';
import {Library,Notifications} from './look/screens/Library';
import {visiblePoll} from './visible-poll';
export function LibraryScreen({readOnly,notifications=false}:{readOnly:boolean;notifications?:boolean}) {
 const [items,setItems]=useState<RecordingItem[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;const poll=visiblePoll(async signal=>{try{const r=await fetch(notifications ? '/api/notifications':'/api/library',{signal});if(!r.ok)throw new Error();const data=await r.json();if(alive){setItems(notifications ? data.items:data);setError('')}}catch{if(alive)setError('Your recordings could not load. Reload this page to try again.')}},3000);return()=>{alive=false;poll.stop()}},[notifications]);
 const Screen=notifications ? Notifications:Library;return <Screen items={items} error={error} readOnly={readOnly}/>;
}
