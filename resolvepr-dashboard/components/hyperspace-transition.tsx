const STAR_COUNT = 28

export function HyperspaceTransition() {
  return (
    <div className="hyperspace-transition" aria-hidden="true">
      <div className="hyperspace-core" />
      <div className="hyperspace-stars">
        {Array.from({ length: STAR_COUNT }, (_, index) => <span key={index} />)}
      </div>
      <p>Next: the review flow</p>
    </div>
  )
}
