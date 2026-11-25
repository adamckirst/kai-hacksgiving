import { useState } from 'react'
import { Button, Card, Field, Notice, TextLink } from '../ui'

/**
 * The waitlist card, at the foot of Home and under a recording once its
 * suggestions are decided. Its button stays quiet: it is never the screen's
 * filled violet one.
 */
export function Waitlist({
  postUrl,
  saved,
  busy,
  error,
  onSubmit,
}: {
  postUrl: string | null
  saved?: boolean
  busy?: boolean
  error?: string
  onSubmit: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  return (
    <Card aria-label="Keep me posted" className="p-5">
      <h2 className="text-xl font-extrabold tracking-tight">Would you use something like this?</h2>
      <p className="mt-1 text-base font-medium text-zinc-600">
        Leave your email and I’ll write once if it becomes a product. Only for that one note; ask me and I delete it.
      </p>
      {saved ? (
        <div className="mt-4">
          <Notice tone="good">You’re on the list. Thank you.</Notice>
        </div>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(email)
          }}
        >
          <Field label="Email" id="waitlist-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
          {error && <Notice tone="error">{error}</Notice>}
          <Button variant="outline" type="submit" wide disabled={busy}>
            {busy ? 'Saving…' : 'Keep me posted'}
          </Button>
        </form>
      )}
      <div className="mt-2">
        {postUrl ? (
          <TextLink href={postUrl} icon="right">
            See the post on X
          </TextLink>
        ) : (
          <p className="pt-2 text-base font-medium text-zinc-500">The post on X will be linked here once it is up.</p>
        )}
      </div>
    </Card>
  )
}

/** Copal's own page, behind his download link: how many, and the download. */
export function Operator({ count, error, busy, onDownload }: { count: number | null; error?: string; busy?: boolean; onDownload: () => void }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[560px] px-4 pt-8">
      <span className="px-1 text-xl font-extrabold tracking-tight text-violet-700">KAI</span>
      <main className="mt-6">
        <h1 className="px-1 text-[32px]/10 font-extrabold tracking-tight">Your waitlist</h1>
        <Card className="mt-5 space-y-4 p-5">
          {count === null ? (
            <>
              <p className="text-base font-medium text-zinc-600">{error || 'Opening the list…'}</p>
              <Button variant="primary" wide href="/home">
                Go to Home
              </Button>
            </>
          ) : (
            <>
              <p className="text-[40px]/none font-extrabold tracking-tight text-violet-700">
                {count} <span className="text-base font-bold text-zinc-600">{count === 1 ? 'address' : 'addresses'}</span>
              </p>
              <p className="text-base font-medium text-zinc-600">
                Use these only for the one note promised on the card. Download before deleting the demo on 8 December.
              </p>
              {error && <Notice tone="error">{error}</Notice>}
              <Button variant="primary" wide disabled={busy} onClick={onDownload}>
                {busy ? 'Downloading…' : 'Download addresses'}
              </Button>
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
