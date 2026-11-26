import type { Access } from '../types'
import { Button, CARD, Footer, Notice } from '../ui'
import { Icon } from '../icons'

/**
 * The first screen for everyone: what KAI is, the video once there is one,
 * and one button. `access` is empty while the link is being opened.
 */
export function Welcome({ access, failed }: { access: Access | null; failed?: boolean }) {
  const opening = !access && !failed
  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-5 pt-6 pb-6">
      <span className="text-2xl font-extrabold tracking-tight text-violet-700">KAI</span>
      <main className="flex flex-1 animate-kai-in flex-col justify-center py-8">
        <h1 className="text-[40px]/[1.1] font-extrabold tracking-tight">
          The recordings you never replay, <span className="text-violet-700">put to work.</span>
        </h1>
        <p className="mt-4 text-lg/8 font-medium text-zinc-600">
          Share a voice note in. KAI finds the people, the notes and the promises in it, each with the words it heard. You decide what to keep.
        </p>

        <ul className="mt-6 space-y-3">
          {(
            [
              ['mic', 'Voice memos and WhatsApp voice notes'],
              ['sparkle', 'KAI remembers who you already know'],
              ['todo', 'Nothing is kept until you accept it'],
            ] as const
          ).map(([icon, text]) => (
            <li key={text} className="flex items-center gap-3 text-base font-semibold text-zinc-800">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                <Icon name={icon} />
              </span>
              {text}
            </li>
          ))}
        </ul>

        {access?.videoUrl && (
          <section className="mt-8">
            <h2 className="mb-2 px-1 text-base font-extrabold text-zinc-500">See the demo</h2>
            <video controls preload="metadata" src={access.videoUrl} aria-label="See the demo" className={`${CARD} aspect-video w-full bg-zinc-900 object-cover`} />
          </section>
        )}

        <div className="mt-8 space-y-3">
          {failed && <Notice tone="error">This link could not be opened. Ask for a new link, or look around the demo.</Notice>}
          {opening ? (
            <Button variant="primary" wide disabled>
              Opening your notebook…
            </Button>
          ) : (
            <Button variant="primary" wide href={access?.kind === 'judge' ? '/home' : '/try'}>
              Try it yourself
            </Button>
          )}
          {!opening && access?.kind !== 'judge' && <>
            <p className="text-center text-base font-medium text-zinc-600">Join the waitlist. Try an hour of your own recordings.</p>
            <Button variant="quiet" wide href="/home">Look around</Button>
          </>}
        </div>
      </main>
      <Footer />
    </div>
  )
}
