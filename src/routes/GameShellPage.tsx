import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChessBoardStage } from '../components/board/ChessBoardStage'
import { ChessHintControls } from '../components/controls/ChessHintControls'
import { createChessSceneBinding } from '../domain/chessScene'

export function GameShellPage() {
  const [sceneBinding] = useState(() => createChessSceneBinding())

  return (
    <section className="game-shell-page">
      <ChessBoardStage
        binding={sceneBinding}
        controls={<ChessHintControls binding={sceneBinding} />}
      />

      <div className="game-shell-page__footer">
        <p className="body-copy">
          Graph task <code>chess-008d</code> now wires the reusable hint
          controls through a shared scene binding into the live 3D board shell.
        </p>

        <Link className="secondary-link" to="/">
          Back to home
        </Link>
      </div>
    </section>
  )
}
