import { useEffect,useState } from 'react';
import { Button } from './catalyst/button';

export function ConnectScreen({kind}:{kind:'judge'|'public'|undefined}) {
  const [address,setAddress]=useState(''),[assistant,setAssistant]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[feedbackAt,setFeedbackAt]=useState('upload');
  const home=location.origin+'/home';
  useEffect(()=> {
    if(kind!=='judge')return;
    fetch('/api/connect').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{setAddress(location.origin+data.uploadPath);setAssistant(location.origin+data.mcpPath);}).catch(()=>setError('Your address could not load. Reload this page to try again.'));
  },[kind]);
  async function copy(value:string,target:string) {
    setFeedbackAt(target);
    setMessage('');setError('');
    try{await navigator.clipboard.writeText(value);setMessage('Copied.');}
    catch{setError('Touch and hold the address to copy it.');}
  }
  const feedback=(target:string)=>feedbackAt===target && (error ? <p role="alert">{error}</p>:message ? <p role="status">{message}</p>:null);
  return <main><h1>Connect</h1><h2>Send to KAI from your phone</h2>
    {kind==='public' ? <><p className="notice">A read-only demo with made-up data.</p><p>In your own copy, add “Send to KAI” to your iPhone’s share sheet. Share a voice note from WhatsApp or Voice Memos, then decide what to keep.</p></> : kind==='judge' ? <>
      <p>Set this up once in Apple Shortcuts. Keep this address private: anyone with it can add recordings to your copy.</p>
      <label htmlFor="sharing-address">Your private address</label><textarea id="sharing-address" className="connect-address" readOnly value={address} rows={3}/>
      <Button color="violet" className="primary" disabled={!address} onClick={()=>void copy(address,'upload')}>Copy your address</Button>
      {feedback('upload')}
      <h2>Add “Send to KAI”</h2>
      <Button outline href="https://www.icloud.com/shortcuts/5d7d8a29c386458bb5c95b14c35ac6ab" className="connect-copy">Add the shortcut</Button>
      <p>Copy your private address above, then open the shortcut link and tap Add Shortcut. In Shortcuts, open its editor and replace the URL field with your private address. Replace the final Open URLs field with the KAI home address below. Tap Done.</p>
      <h2>Or build it yourself</h2><ol className="connect-steps">
        <li>In Shortcuts, tap + and name the shortcut “Send to KAI”. Open Details, turn on “Show in Share Sheet”, and choose Files and Media as its input.</li>
        <li>Add “Get Details of Files”. Choose Creation Date from Shortcut Input. Add “Format Date”, choose ISO 8601, and include the time.</li>
        <li>Add “URL” and paste your private address above.</li>
        <li>Add “Get Contents of URL”. Expand its options, choose POST, then Form for Request Body. Add a File field named <strong>recordings</strong> and set it to Shortcut Input. Add a Text field named <strong>date</strong> and set it to Formatted Date.</li>
        <li>Add “Get Dictionary Value” with key <strong>error</strong> from Contents of URL. Add “If” Dictionary Value has any value: “Show Alert” with Dictionary Value, then “Stop This Shortcut”. Leave Otherwise empty.</li>
        <li>After End If, add “Open URLs” with the KAI home address below. Tap Done. Use the same Safari browser where you opened your own copy.</li>
      </ol>
      <label htmlFor="home-address">KAI home address</label><textarea id="home-address" className="connect-address" readOnly value={home} rows={2}/><Button outline onClick={()=>void copy(home,'home')} className="connect-copy">Copy home address</Button>{feedback('home')}
      <h2>Try it</h2><p>In WhatsApp, hold a voice note, choose Forward, then Share and “Send to KAI”. In Voice Memos, choose a recording, then More → Share → Options → Rendered, and “Send to KAI”. Allow Shortcuts to send the file when asked. KAI opens Home; tap the recording to see its progress and suggestions.</p>
      <p>Share one audio file at a time, up to 10 MB and five minutes. If the original date is missing, replace “Get Details of Files” with “Ask for Input”, choose Date and Time, and enter the recording’s date when sharing. Home also accepts up to five files at once.</p>
      <p>Your recording is transcribed by AssemblyAI and read by Claude. It stays in your own copy of this demo, which is deleted on 8 December.</p>
    </> : <p role="status">Opening your notebook…</p>}
    <h2>Connect an assistant</h2><p>Your assistant can read your accepted people, notes and to-dos with their quotes, and search your recordings’ words. It cannot change anything or send anything.</p>
    {kind==='judge' && <><p>Keep this address private: it gives read access to your copy.</p><label htmlFor="assistant-address">Your assistant address</label><textarea id="assistant-address" className="connect-address" readOnly value={assistant} rows={3}/><Button outline disabled={!assistant} onClick={()=>void copy(assistant,'assistant')} className="connect-copy">Copy assistant address</Button>{feedback('assistant')}<ol className="connect-steps"><li>In Claude, open Settings → Connectors → Add custom connector.</li><li>Name it “KAI” and paste your assistant address as the connection address. Add and connect it.</li><li>Open a conversation, enable KAI, and ask “What do I owe Dana this week?”</li></ol></>}
    {kind==='public' && <p>Open your own copy to get an assistant address.</p>}
    {kind!=='judge' && <Button color="violet" href="/people" className="primary">See people</Button>}
  </main>;
}
