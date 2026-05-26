import {
  CHESS_AI_DIFFICULTY_OPTIONS,
  CHESS_GAME_MODE_OPTIONS,
  describeChessAiMatchSettings,
  setChessAiDifficulty,
  setChessAiMode,
  type ChessAiMatchSettings,
} from '../../ai/gameMode'

interface ChessAiMatchControlsProps {
  isThinking?: boolean
  value: ChessAiMatchSettings
  onChange: (nextValue: ChessAiMatchSettings) => void
}

export function ChessAiMatchControls({
  isThinking = false,
  value,
  onChange,
}: ChessAiMatchControlsProps) {
  const description = describeChessAiMatchSettings(value, {
    isThinking,
  })

  return (
    <section
      aria-labelledby="ai-match-controls-title"
      className="board-stage__feedback"
    >
      <p className="eyebrow">Graph task chess-007b</p>
      <p className="board-stage__feedback-title" id="ai-match-controls-title">
        Human vs AI
      </p>
      <p className="board-stage__feedback-detail">{description.statusLabel}</p>
      <p className="board-stage__feedback-detail">
        {description.statusDetail}
      </p>
      <p className="board-stage__feedback-detail">
        Graph task chess-007b connects one automated AI reply after each
        completed human move.
      </p>

      <fieldset className="board-stage__selection-group">
        <legend className="board-stage__selection-legend">Game mode</legend>
        <div className="board-stage__selection-grid">
          {CHESS_GAME_MODE_OPTIONS.map((mode) => {
            const label =
              mode === 'human-vs-human' ? 'Human vs Human' : 'Human vs AI'

            return (
              <label className="board-stage__selection-option" key={mode}>
                <input
                  checked={value.mode === mode}
                  name="chess-game-mode"
                  onChange={() => onChange(setChessAiMode(value, mode))}
                  type="radio"
                />
                <span>{label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="board-stage__selection-group">
        <legend className="board-stage__selection-legend">AI difficulty</legend>
        <div className="board-stage__selection-grid">
          {CHESS_AI_DIFFICULTY_OPTIONS.map((difficulty) => {
            const label =
              difficulty.charAt(0).toUpperCase() + difficulty.slice(1)

            return (
              <label className="board-stage__selection-option" key={difficulty}>
                <input
                  checked={value.difficulty === difficulty}
                  name="chess-ai-difficulty"
                  onChange={() =>
                    onChange(setChessAiDifficulty(value, difficulty))
                  }
                  type="radio"
                />
                <span>{label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </section>
  )
}
