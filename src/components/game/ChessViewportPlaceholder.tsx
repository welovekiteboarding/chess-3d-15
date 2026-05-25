export function ChessViewportPlaceholder() {
  return (
    <section className="viewport-card" aria-labelledby="game-shell-heading">
      <div className="viewport-card__copy">
        <p className="eyebrow">3D runtime scaffold</p>
        <h2 id="game-shell-heading">Game Shell</h2>
        <p className="body-copy">
          The canvas mount point is ready for the React Three Fiber scene work
          in later chess tasks.
        </p>
      </div>

      <div
        aria-label="Chess board viewport placeholder"
        className="board-preview"
        role="img"
      >
        <div className="board-preview__glow" />
      </div>
    </section>
  )
}
