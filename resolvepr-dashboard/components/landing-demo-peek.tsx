'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

export function LandingDemoPeek() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setScrollY(window.scrollY)
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

  const visible = scrollY > 24
  const stage = scrollY < 560 ? 0 : scrollY < 900 ? 1 : scrollY < 1240 ? 2 : scrollY < 1580 ? 3 : scrollY < 1820 ? 4 : scrollY < 2100 ? 5 : 6
  const stories = [
    ['PR opened', 'A pull request starts the focused security review.'],
    ['tree-sitter builds the syntax tree', 'The changed file is parsed structurally, not treated as plain text.'],
    ['Touched function extracted', 'The review keeps the function and drops unrelated file context.'],
    ['Claude reviews the function', 'Claude returns a severity, CWE, confidence, and fix.'],
    ['Suggestions appear on the diff', 'Each focused finding becomes an actionable review comment.'],
    ['Ready to commit', 'Commit a safe fix now or add it to a review batch.'],
    ['Review the function—not the file', 'The focused function carries the review into the next section.'],
  ] as const
  const [storyTitle, storyBody] = stories[stage]

  return (
    <div className={`demo-peek${visible ? ' is-scroll-visible' : ''}${stage >= 4 ? ' is-suggestion-visible' : ''}${stage >= 5 ? ' is-action-menu-visible' : ''}${stage === 6 ? ' is-handoff' : ''}`} aria-label="Preview of the ResolvePR demo">
      <div className="peek-story"><span className="peek-story-index">0{Math.min(stage + 1, 6)}</span><strong>{storyTitle}</strong><span>{storyBody}</span></div>
      <div className="peek-toolbar">
        <Image src="/resolvepr-shield.svg" alt="" width={24} height={24} />
        <strong>ResolvePR demo</strong>
        <span className="peek-repo">acme/payments #142</span>
        <div className="peek-steps" aria-hidden><span className={stage === 0 ? 'active' : stage > 0 ? 'done' : ''}>01 PR</span><i>→</i><span className={stage === 1 || stage === 2 ? 'active' : stage > 2 ? 'done' : ''}>02 AST</span><i>→</i><span className={stage === 3 ? 'active' : stage > 3 ? 'done' : ''}>03 Review</span><i>→</i><span className={stage === 4 ? 'active' : ''}>04 Results</span></div>
      </div>
      <div className="peek-grid">
        <pre className={`peek-code stage-${stage}`}><span>{stage === 0 ? 'Pull request #142 · payments/transfer.go' : stage === 1 ? 'AST → function_declaration → transfer' : '81  func transfer(amount int, to string) {'}</span>{'\n'}<mark>{stage === 0 ? '+ 82  UPDATE accounts' : stage === 1 ? '└─ changed_line 82' : '82    db.Exec("UPDATE accounts " + amount)'}</mark>{'\n'}<span>{stage === 2 ? 'Only this function is sent for review.' : '83    notify(to)'}</span>{'\n'}<span>{stage === 2 ? 'Unrelated file context is excluded.' : '84  }'}</span></pre>
        <div className="peek-finding"><span>CRITICAL · CWE-89 · 99%</span><h3>SQL query construction includes untrusted input.</h3><p>ResolvePR pins the finding to the changed line and prepares an inline suggestion.</p><div className="peek-review-stack" aria-hidden={stage < 4}><span>✓ Input reaches query builder</span><span>✓ Parameterized fix prepared</span><span className={stage >= 5 ? 'is-visible' : ''}>✓ Check run updated</span></div></div>
      </div>
      <div className="peek-suggestion" aria-hidden={stage < 4}>
        <div className="peek-suggestion-copy"><span>ResolvePR · inline suggestion</span><strong>Replace the concatenated query with a parameterized call.</strong></div>
        <div className="peek-suggestion-actions"><button type="button">Commit suggestion</button><button type="button">Add suggestion to batch</button></div>
      </div>
      <div className="peek-action-popover" aria-hidden={stage < 5}>
        <span>ResolvePR suggestion</span>
        <strong>Apply the parameterized query fix?</strong>
        <div><button type="button">Commit suggestion</button><button type="button">Add to batch</button></div>
      </div>
    </div>
  )
}
