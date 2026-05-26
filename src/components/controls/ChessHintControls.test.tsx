import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createChessGame } from '../../chess/engine'
import {
  createChessGamePersistence,
  createPersistedChessSceneBinding,
} from '../../chess/persistence'
import { createChessSceneBinding } from '../../domain/chessScene'
import type { StorageLike } from '../../persistence/browserStorage'
import { ChessHintControls } from './ChessHintControls'

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>()

  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

describe('ChessHintControls', () => {
  it('replaces a visible hint after the board changes and keeps dismissed hints hidden', () => {
    const persistence = createChessGamePersistence({
      storage: createMemoryStorage(),
    })
    const binding = createPersistedChessSceneBinding({
      initialGame: createChessGame({
        pieces: [
          { square: 'g1', color: 'white', type: 'king' },
          { square: 'd4', color: 'white', type: 'queen' },
          { square: 'g8', color: 'black', type: 'king' },
          { square: 'd7', color: 'black', type: 'rook' },
        ],
        turn: 'white',
      }),
      persistence,
    })

    render(<ChessHintControls binding={binding} persistence={persistence} />)

    const clearSavedGameButton = screen.getByRole('button', {
      name: 'Clear saved game',
    })

    expect(screen.getByText('Issue C31-46')).toBeInTheDocument()
    expect(
      screen.getByText(
        /No saved game is stored yet\. Your first move will create a local save on this device\./i,
      ),
    ).toBeInTheDocument()
    expect(clearSavedGameButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Show hint' }))

    expect(screen.getByText('Recommended move: d4 -> d7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide hint' })).toBeInTheDocument()

    act(() => {
      binding.move({ from: 'd4', to: 'd5' })
    })

    expect(
      screen.getByText(/Saved locally after 1 move: d4 -> d5\./i),
    ).toBeInTheDocument()
    expect(clearSavedGameButton).toBeEnabled()
    expect(screen.getByText('Recommended move: d7 -> d5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide hint' }))

    act(() => {
      binding.move({ from: 'd7', to: 'd5' })
    })

    expect(
      screen.getByText(/Saved locally after 2 moves: d7 -> d5\./i),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Request a recommended move for the current player.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show hint' })).toBeInTheDocument()
  })

  it('uses the provided persistence state instead of inferring a save from move history', () => {
    const persistence = createChessGamePersistence({
      storage: createMemoryStorage(),
    })
    const binding = createChessSceneBinding(
      createChessGame({
        pieces: [
          { square: 'g1', color: 'white', type: 'king' },
          { square: 'd4', color: 'white', type: 'queen' },
          { square: 'g8', color: 'black', type: 'king' },
          { square: 'd7', color: 'black', type: 'rook' },
        ],
        turn: 'white',
      }),
    )

    render(<ChessHintControls binding={binding} persistence={persistence} />)

    act(() => {
      binding.move({ from: 'd4', to: 'd5' })
    })

    expect(
      screen.getByText(
        /No saved game is stored yet\. Your first move will create a local save on this device\./i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Clear saved game' }),
    ).toBeDisabled()
  })
})
