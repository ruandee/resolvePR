import { tokenize } from '@/lib/highlight'

/** One line of code with light syntax colouring. Renders a non-breaking space for empty lines. */
export function CodeTokens({ line, lang }: { line: string; lang: string }) {
  if (line === '') return <>{' '}</>
  return (
    <>
      {tokenize(line, lang).map((t, i) =>
        t.kind === 'plain' ? <span key={i}>{t.text}</span> : <span key={i} className={`tok-${t.kind}`}>{t.text}</span>,
      )}
    </>
  )
}
