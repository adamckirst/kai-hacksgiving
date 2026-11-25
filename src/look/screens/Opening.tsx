import { Button, Card, Working } from '../ui'

/** Keep the requested page while its access check finishes. */
export function Opening({ page, failed, onRetry }: { page: string; failed?: boolean; onRetry: () => void }) {
  return <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center gap-5 px-4 py-10">
    <p className="text-xl font-extrabold text-violet-700">KAI</p>
    <Card className="space-y-5 p-6">
      <h1 className="text-[30px]/9 font-extrabold tracking-tight">{page}</h1>
      {failed ? <p role="alert" className="text-base/7 font-medium text-zinc-700">This page could not open. Try again.</p> :
        <p role="status" className="flex items-center gap-3 text-base/7 font-semibold text-zinc-600"><Working />Opening {page.toLowerCase()}…</p>}
      <Button variant="primary" wide disabled={!failed} onClick={onRetry}>{failed ? 'Try again' : 'Opening…'}</Button>
    </Card>
  </main>
}
