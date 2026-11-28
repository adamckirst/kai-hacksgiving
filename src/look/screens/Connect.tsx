import {useState,type ReactNode} from 'react'
import { Icon, type IconName } from '../icons'
import type { Connection } from '../types'
import { Button, Card, FOCUS, Notice, PushedPage, WhatIsKai } from '../ui'

/** An address to copy: shown whole, selectable, never a field you type in. */
function Address({ label, id, value }: { label: string; id: string; value: string }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block px-1 text-base font-bold text-zinc-700">{label}</span>
      <textarea
        id={id}
        readOnly
        rows={3}
        value={value}
        onFocus={(event) => event.target.select()}
        className="block w-full resize-none rounded-2xl bg-violet-50 px-4 py-3 font-mono text-base break-all text-violet-950 ring-1 ring-violet-200 focus:ring-2 focus:ring-violet-500 focus:outline-none"
      />
    </label>
  )
}

function Steps({ children }: { children: ReactNode[] }) {
  return (
    <ol className="space-y-4">
      {children.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-base font-extrabold text-violet-800">{index + 1}</span>
          <p className="min-w-0 flex-1 pt-0.5 text-base/7 font-medium text-zinc-700">{step}</p>
        </li>
      ))}
    </ol>
  )
}

function Heading({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-extrabold tracking-tight">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700">
        <Icon name={icon} className="size-6" />
      </span>
      {children}
    </h2>
  )
}

const B = ({ children }: { children: ReactNode }) => <strong className="font-extrabold text-zinc-900">{children}</strong>

/**
 * Connect: "Send to KAI" from the phone's share sheet, and an assistant that
 * reads what you accepted. `copied` names the address just copied.
 */
export function Connect({
  connection,
  readOnly,
  due,
  copied,
  error,
  copyError,
  onCopy,
  showManual,
  showAddress,
  onSetupDone,
  setupBusy,
  back = "/settings",
  initialAssistant = "Claude",
}: {
  initialAssistant?: 'Claude' | 'ChatGPT' | 'Grok' | 'Cursor'
  onSetupDone?: (ready:boolean) => void
  setupBusy?: boolean
  back?: string
  showManual?: boolean
  showAddress?: boolean
  connection: Connection | null
  readOnly: boolean
  due?: 'overdue' | 'soon'
  copied?: 'upload' | 'home' | 'assistant' | null
  error?: string
  copyError?: { at: 'upload' | 'home' | 'assistant'; text: string } | null
  onCopy: (which: 'upload' | 'home' | 'assistant', value: string) => void
}) {
  const [assistant,setAssistant]=useState(initialAssistant)
  const ready=Boolean(connection?.shortcutReady)
  const feedback = (which: 'upload' | 'home' | 'assistant') => copyError?.at === which ? <Notice tone="error">{copyError.text}</Notice> : copied === which && <Notice tone="good">Copied.</Notice>
  return (
    <PushedPage back={back} backLabel={back==='/home' ? 'Back to Home':back==='/settings'?'Back to Settings':'Back to upload'} readOnly={readOnly} dock={readOnly ? <WhatIsKai /> : undefined}>
      <header className="px-1"><h1 className="text-[32px]/10 font-extrabold">Connections</h1><p className="mt-2 text-base/7 text-zinc-600">Set up your phone or let an assistant read what you kept.</p></header>
      {error && <Notice tone="error">{error}</Notice>}


      <Card className="space-y-5 p-5">
        <Heading icon="share">Send to KAI from your phone</Heading>
        {readOnly ? (
          <p className="text-base/7 font-medium text-zinc-700">
            In your own copy, you add “Send to KAI” to your iPhone’s share sheet. Then a voice note goes in from WhatsApp or Voice Memos without opening KAI, and you decide what to keep.
          </p>
        ) : !connection ? (
          <>
            {!error && <Notice>Opening your notebook…</Notice>}
            <Button variant="primary" wide icon="copy" disabled>Copy your address</Button>
          </>
        ) : (
          <>
            <button type="button" role="checkbox" aria-checked={ready} disabled={setupBusy || !onSetupDone} onClick={()=>onSetupDone?.(!ready)} className={`${FOCUS} flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-base font-bold`}>
              <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded border-2 ${ready?'border-violet-600 bg-violet-600 text-white':'border-zinc-300 bg-white'}`}>{ready && <Icon name="check" className="size-4"/>}</span>
              {setupBusy?'Saving…':'I already have the shortcut set up'}
            </button>
            {ready ? <p className="text-base/7 text-zinc-600">Your phone shortcut is set up. Connect an assistant below, or return to your recording.</p> : <>
            <p className="text-base/7 font-medium text-zinc-600">Set up once. Then share voice notes straight to KAI.</p>
            <ol aria-label="Phone setup" className="divide-y divide-zinc-100">
              <li className="space-y-3 pb-5">
                <h3 className="text-lg font-extrabold">1. Copy your address</h3>
                <Button variant="primary" wide icon="copy" onClick={() => onCopy('upload', connection.uploadAddress)}>Copy your address</Button>
                {feedback('upload')}
                <p className="text-base/7 font-medium text-zinc-500">Keep it private. Anyone with it can add recordings to your notebook.</p>
                <details open={showAddress || copyError?.at === 'upload' || undefined}>
                  <summary className={`${FOCUS} min-h-11 cursor-pointer rounded-xl py-2 text-base font-bold text-zinc-600`}>Show your address</summary>
                  <div className="pt-2"><Address label="Your private address" id="sharing-address" value={connection.uploadAddress}/></div>
                </details>
              </li>
              <li className="space-y-3 py-5">
                <h3 className="text-lg font-extrabold">2. Add the iOS shortcut</h3>
                <Button variant="outline" wide href="https://www.icloud.com/shortcuts/5d7d8a29c386458bb5c95b14c35ac6ab">Add the shortcut</Button>
                <p className="text-base/7 font-medium text-zinc-700">Tap <B>Add Shortcut</B>, then open its editor. Paste the address from step 1 into <B>URL</B>. Set the final <B>Open URLs</B> to the upload address below, then tap <B>Done</B>.</p>
                <Address label="KAI upload address" id="home-address" value={connection.homeAddress}/>
                <Button variant="outline" wide icon="copy" onClick={() => onCopy('home', connection.homeAddress)}>Copy upload address</Button>
                {feedback('home')}
                <details open={showManual || undefined}>
                  <summary className={`${FOCUS} min-h-11 cursor-pointer rounded-xl py-2 text-base font-bold text-zinc-600`}>Build it yourself</summary>
                  <div className="space-y-4 pt-3">
                    <p className="text-base/7 font-medium text-zinc-600">Only needed if you can’t add the shortcut above.</p>
                    <Steps>
                      {[
                        <>
                          In Shortcuts, tap + and name the shortcut <B>Send to KAI</B>. Open Details, turn on <B>Show in Share Sheet</B>, and choose Files and Media as its input.
                        </>,
                        <>
                          Add <B>Get Details of Files</B> and choose Creation Date from Shortcut Input. Add <B>Format Date</B>, choose ISO 8601, and include the time.
                        </>,
                        <>
                          Add <B>URL</B> and paste your private address.
                        </>,
                        <>
                          Add <B>Get Contents of URL</B>. Choose POST, then Form. Add a File field named <B>recordings</B> set to Shortcut Input, and a Text field named <B>date</B> set to Formatted Date.
                        </>,
                        <>
                          Add <B>Get Dictionary Value</B> with the key <B>error</B>. Add <B>If</B> it has any value: Show Alert with it, then Stop This Shortcut.
                        </>,
                        <>
                          After End If, add <B>Open URLs</B> with the KAI upload address above. Tap Done.
                        </>,
                      ]}
                    </Steps>
                  </div>
                </details>
              </li>
              <li className="space-y-3 pt-5">
                <h3 className="text-lg font-extrabold">3. Try it</h3>
                <p className="text-base/7 font-medium text-zinc-700">In WhatsApp, hold a voice note, then choose <B>Forward → Share → Send to KAI</B>. In Voice Memos, choose a recording, then <B>Share → Send to KAI</B>.</p>
                <p className="text-base/7 font-medium text-zinc-700">KAI opens with the recording attached. Choose <B>My memo</B>, <B>Someone else</B>, or <B>Multiple speakers</B>. For Someone else, choose the speaker before reading. For Multiple speakers, identify speakers after transcription.</p>
                <p className="text-base/7 font-medium text-zinc-500">One file at a time, up to 10 MB and under 30 minutes.</p>
              </li>
            </ol>
            </>}
          </>
        )}
      </Card>

      <Card className="space-y-5 p-5">
        <Heading icon="sparkle">Connect an assistant</Heading>
        <p className="text-base/7 font-medium text-zinc-700">
          Your assistant can read the people, notes and to-dos you accepted, with their quotes, and search your recordings’ words. It cannot change anything or send anything.
        </p>
        {readOnly ? (
          <p className="text-base/7 font-medium text-zinc-500">Open your own copy to get an assistant address.</p>
        ) : (
          connection && (
            <>
              <Address label="Your assistant address" id="assistant-address" value={connection.assistantAddress} />
              <Button variant={ready?"primary":"outline"} wide icon="copy" onClick={() => onCopy('assistant', connection.assistantAddress)}>
                Copy assistant address
              </Button>
              {feedback('assistant')}
              <p className="text-base/7 text-zinc-500">Keep this address private: anyone with it can read your notebook.</p>
              <fieldset className="space-y-3"><legend className="text-base font-bold">Choose your assistant</legend><div className="grid grid-cols-2 gap-2">{(['Claude','ChatGPT','Grok','Cursor'] as const).map(name=><button key={name} type="button" aria-pressed={assistant===name} onClick={()=>setAssistant(name)} className={`${FOCUS} min-h-11 rounded-xl border px-3 py-2 text-base font-bold ${assistant===name?'border-violet-400 bg-violet-50 text-violet-700':'border-zinc-200 text-zinc-600'}`}>{name}</button>)}</div></fieldset>
              <AssistantSteps name={assistant}/>

            </>
          )
        )}
      </Card>
    </PushedPage>
  )
}

const assistantHelp={
 Claude:'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
 ChatGPT:'https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta',
 Grok:'https://docs.x.ai/grok/connectors',
 Cursor:'https://cursor.com/docs/mcp',
}
function AssistantSteps({name}:{name:keyof typeof assistantHelp}) {
 const steps:Record<keyof typeof assistantHelp,ReactNode[]>={
  Claude:[<>Open Claude’s <B>Customize → Connectors</B>, then <B>Add → Add custom connector</B>. Your workspace may need its owner to add it first.</>,<>Name it <B>KAI</B>, paste your assistant address and choose <B>No sign in</B> if asked. The private address already gives access.</>,<>Connect KAI, enable it in a conversation’s tool menu and ask <B>What tasks do I have in KAI?</B></>],
  ChatGPT:[<>Use ChatGPT on the web. In <B>Settings → Apps → Advanced settings</B>, enable <B>Developer mode</B>. Availability depends on your plan and workspace permissions.</>,<>Under <B>Apps</B>, choose <B>Create</B>. Name it <B>KAI</B>, paste your assistant address and choose <B>No authentication</B>. Scan the tools and create the app.</>,<>Start a chat, select KAI from the apps menu and ask <B>What tasks do I have in KAI?</B></>],
  Grok:[<>Open <B>grok.com/connectors</B>. Choose <B>New Connector → Custom</B>. A work account may need its admin to add it first.</>,<>Name it <B>KAI</B> and paste your assistant address as the server URL. No extra sign-in is needed for this private address.</>,<>Finish adding it, then ask Grok <B>What tasks do I have in KAI?</B></>],
  Cursor:[<>Open Cursor’s <B>Customize</B> page and add a custom MCP server.</>,<>Use an HTTP server named <B>KAI</B> with your assistant address as its URL. Keep this private configuration out of shared projects.</>,<>Enable KAI’s tools in Agent, then ask <B>What tasks do I have in KAI?</B></>],
 }
 return <section aria-label={`${name} setup`} className="space-y-3"><Steps>{steps[name]}</Steps><a className={`${FOCUS} inline-flex min-h-11 items-center rounded-lg text-base font-bold text-violet-700 underline`} href={assistantHelp[name]} target="_blank" rel="noreferrer">{name}’s setup guide</a></section>
}
