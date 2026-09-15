'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

export function LandingDemoPeek() {
  const [suggestionVisible, setSuggestionVisible] = useState(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setSuggestionVisible(window.scrollY > 180)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className={`demo-peek${suggestionVisible ? ' is-suggestion-visible' : ''}`} aria-label="Preview of the ResolvePR demo">
      <div className="peek-toolbar">
        <Image src="/resolvepr-shield.svg" alt="" width={24} height={24} />
        <strong>ResolvePR demo</strong>
        <span className="peek-repo">acme/payments #142</span>
        <div className="peek-steps" aria-hidden><span>01 Diff</span><span>02 Functions</span><span className="active">03 Review</span><span>04 Results</span></div>
      </div>
      <div className="peek-grid">
        <pre><span>81  func transfer(amount int, to string) {'{'}</span>{'\n'}<mark>82    db.Exec(&quot;UPDATE accounts &quot; + amount)</mark>{'\n'}<span>83    notify(to)</span>{'\n'}<span>84  {'}'}</span></pre>
        <div className="peek-finding"><span>CRITICAL · CWE-89 · 99%</span><h3>SQL query construction includes untrusted input.</h3><p>ResolvePR pins the finding to the changed line and prepares an inline suggestion.</p></div>
      </div>
      <div className="peek-suggestion" aria-hidden={!suggestionVisible}>
        <div className="peek-suggestion-copy"><span>ResolvePR · inline suggestion</span><strong>Replace the concatenated query with a parameterized call.</strong></div>
        <div className="peek-suggestion-actions"><button type="button">Commit suggestion</button><button type="button">Add suggestion to batch</button></div>
      </div>
    </div>
  )
}
