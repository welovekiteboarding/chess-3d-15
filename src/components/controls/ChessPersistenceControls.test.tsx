import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createChessGamePersistence,
  createPersistedChessSceneBinding,
} from '../../chess/persistence'
import type { StorageLike } from '../../persistence/browserStorage'
import { ChessPersistenceControls } from './ChessPersistenceControls'

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

describe('ChessPersistenceControls', () => {
  it('surfaces local save state and clears the saved session through the live binding', () => {
    const storage = createMemoryStorage()
    const persistence = createChessGamePersistence({ storage })
    const binding = createPersistedChessSceneBinding({ persistence })

    render(
      <ChessPersistenceControls binding={binding} persistence={persistence} />,
    )

    const clearButton = screen.getByRole('button', { name: 'Clear saved game' })

    expect(screen.getByText('Issue C31-46')).toBeInTheDocument()
    expect(
      screen.getByText(
        /No saved game is stored yet\. Your first move will create a local save on this device\./i,
      ),
    ).toBeInTheDocument()
    expect(clearButton).toBeDisabled()

    act(() => {
      binding.move({ from: 'e2', to: 'e4' })
    })

    expect(
      screen.getByText(/Saved locally after 1 move: e2 -> e4\./i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Reloading this page restores the current position\. Clear saved game discards the local session and resets this board to its starting setup\./i,
      ),
    ).toBeInTheDocument()
    expect(clearButton).toBeEnabled()

    fireEvent.click(clearButton)

    expect(
      screen.getByText(
        /No saved game is stored yet\. Your first move will create a local save on this device\./i,
      ),
    ).toBeInTheDocument()
    expect(clearButton).toBeDisabled()
    expect(binding.getGame().history).toHaveLength(0)
    expect(persistence.load()).toBeNull()
  })

  it('reflects a restored local session when the binding reloads from storage', () => {
    const storage = createMemoryStorage()
    const firstPersistence = createChessGamePersistence({ storage })
    const firstBinding = createPersistedChessSceneBinding({
      persistence: firstPersistence,
    })

    act(() => {
      firstBinding.move({ from: 'e2', to: 'e4' })
      firstBinding.move({ from: 'e7', to: 'e5' })
    })

    const restoredPersistence = createChessGamePersistence({ storage })
    const restoredBinding = createPersistedChessSceneBinding({
      persistence: restoredPersistence,
    })

    render(
      <ChessPersistenceControls
        binding={restoredBinding}
        persistence={restoredPersistence}
      />,
    )

    expect(
      screen.getByText(/Saved locally after 2 moves: e7 -> e5\./i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Reloading this page restores the current position\./i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Clear saved game' }),
    ).toBeEnabled()
  })
})
