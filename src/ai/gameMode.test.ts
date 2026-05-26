import { describe, expect, it } from 'vitest'
import { createChessGame, makeMove } from '../chess/engine'
import {
  createChessAiMatchSettings,
  describeChessAiMatchSettings,
  isHumanVsAiMode,
  setChessAiDifficulty,
  setChessAiMode,
} from './gameMode'
import type { ChessGameState, MoveInput } from '../types/chess'

function playMoves(game: ChessGameState, moves: MoveInput[]): ChessGameState {
  return moves.reduce((state, move) => makeMove(state, move), game)
}

describe('chessAiMatchSettings', () => {
  it('starts in human-vs-human mode with medium difficulty preselected', () => {
    const settings = createChessAiMatchSettings()

    expect(settings).toEqual({
      mode: 'human-vs-human',
      difficulty: 'medium',
    })
    expect(describeChessAiMatchSettings(settings)).toMatchObject({
      modeLabel: 'Human vs Human',
      difficultyLabel: 'Medium',
      statusLabel: 'Local human play',
    })
  })

  it('switches to human-vs-ai mode without losing the selected difficulty', () => {
    const hardSettings = setChessAiDifficulty(
      createChessAiMatchSettings(),
      'hard',
    )
    const aiSettings = setChessAiMode(hardSettings, 'human-vs-ai')

    expect(aiSettings).toEqual({
      mode: 'human-vs-ai',
      difficulty: 'hard',
    })
    expect(isHumanVsAiMode(aiSettings)).toBe(true)
    expect(describeChessAiMatchSettings(aiSettings)).toMatchObject({
      statusLabel: 'AI opponent ready',
    })
  })

  it('updates difficulty without changing the selected mode', () => {
    const aiSettings = setChessAiMode(
      createChessAiMatchSettings(),
      'human-vs-ai',
    )

    expect(setChessAiDifficulty(aiSettings, 'easy')).toEqual({
      mode: 'human-vs-ai',
      difficulty: 'easy',
    })
  })

  it('describes the transient thinking state for human-vs-ai turns', () => {
    expect(
      describeChessAiMatchSettings(
        createChessAiMatchSettings({
          mode: 'human-vs-ai',
          difficulty: 'medium',
        }),
        {
          isThinking: true,
        },
      ),
    ).toMatchObject({
      statusLabel: 'AI thinking',
    })
  })

  it('surfaces human, AI, stalemate, and draw outcomes from the resolved board state', () => {
    const settings = createChessAiMatchSettings({
      mode: 'human-vs-ai',
      difficulty: 'medium',
    })
    const aiWinGame = playMoves(createChessGame(), [
      { from: 'f2', to: 'f3' },
      { from: 'e7', to: 'e5' },
      { from: 'g2', to: 'g4' },
      { from: 'd8', to: 'h4' },
    ])
    const staleAiWinGame = {
      ...aiWinGame,
      status: 'active' as const,
      checkedColor: null,
      winner: null,
    }
    const humanWinGame = playMoves(createChessGame(), [
      { from: 'e2', to: 'e4' },
      { from: 'e7', to: 'e5' },
      { from: 'd1', to: 'h5' },
      { from: 'b8', to: 'c6' },
      { from: 'f1', to: 'c4' },
      { from: 'g8', to: 'f6' },
      { from: 'h5', to: 'f7' },
    ])
    const stalemateGame = createChessGame({
      pieces: [
        { square: 'f7', color: 'white', type: 'king' },
        { square: 'g6', color: 'white', type: 'queen' },
        { square: 'h8', color: 'black', type: 'king' },
      ],
      turn: 'black',
    })
    const drawGame = createChessGame({
      pieces: [
        { square: 'e1', color: 'white', type: 'king' },
        { square: 'e8', color: 'black', type: 'king' },
      ],
      halfmoveClock: 100,
    })

    expect(
      describeChessAiMatchSettings(settings, {
        game: staleAiWinGame,
        isThinking: true,
      }),
    ).toMatchObject({
      statusLabel: 'AI wins',
      statusDetail: 'Black wins. White has no legal move to escape check.',
    })
    expect(
      describeChessAiMatchSettings(settings, {
        game: humanWinGame,
      }),
    ).toMatchObject({
      statusLabel: 'Human wins',
      statusDetail: 'White wins. Black has no legal move to escape check.',
    })
    expect(
      describeChessAiMatchSettings(settings, {
        game: stalemateGame,
      }),
    ).toMatchObject({
      statusLabel: 'Stalemate',
      statusDetail: 'Black has no legal moves, and neither king is in check.',
    })
    expect(
      describeChessAiMatchSettings(settings, {
        game: drawGame,
      }),
    ).toMatchObject({
      statusLabel: 'Draw',
      statusDetail:
        'The game is drawn by the fifty-move rule after 50 quiet moves by each side.',
    })
  })
})
