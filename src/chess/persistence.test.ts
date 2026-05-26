import { describe, expect, it } from 'vitest'
import { createChessSceneBinding } from '../domain/chessScene'
import type { StorageLike } from '../persistence/browserStorage'
import { createChessGame } from './engine'
import {
  CHESS_LOCAL_GAME_PERSISTENCE_VERSION,
  CHESS_LOCAL_GAME_STORAGE_KEY,
  createChessGamePersistence,
  createPersistedChessSceneBinding,
} from './persistence'

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

describe('createChessGamePersistence', () => {
  it('stores the current game inside a versioned persistence envelope', () => {
    const storage = createMemoryStorage()
    const persistence = createChessGamePersistence({ storage })
    const game = createChessSceneBinding(createChessGame())

    game.move({ from: 'e2', to: 'e4' })
    persistence.save(game.getGame())

    expect(JSON.parse(storage.getItem(CHESS_LOCAL_GAME_STORAGE_KEY) ?? '')).toEqual(
      expect.objectContaining({
        version: CHESS_LOCAL_GAME_PERSISTENCE_VERSION,
        game: expect.objectContaining({
          turn: 'black',
          history: [
            expect.objectContaining({
              input: expect.objectContaining({
                from: 'e2',
                to: 'e4',
              }),
            }),
          ],
        }),
      }),
    )
  })

  it('returns null when no saved game exists', () => {
    const storage = createMemoryStorage()
    const persistence = createChessGamePersistence({ storage })

    expect(persistence.load()).toBeNull()
  })

  it('clears stale saved data when the stored schema version is unsupported', () => {
    const storage = createMemoryStorage()
    const persistence = createChessGamePersistence({ storage })

    storage.setItem(
      CHESS_LOCAL_GAME_STORAGE_KEY,
      JSON.stringify({
        version: CHESS_LOCAL_GAME_PERSISTENCE_VERSION + 1,
        game: createChessGame(),
      }),
    )

    expect(persistence.load()).toBeNull()
    expect(storage.getItem(CHESS_LOCAL_GAME_STORAGE_KEY)).toBeNull()
  })
})

describe('createPersistedChessSceneBinding', () => {
  it('saves the current game locally and restores it when a new binding is created', () => {
    const storage = createMemoryStorage()
    const persistence = createChessGamePersistence({ storage })
    const firstBinding = createPersistedChessSceneBinding({ persistence })

    firstBinding.move({ from: 'e2', to: 'e4' })
    firstBinding.move({ from: 'e7', to: 'e5' })

    const secondBinding = createPersistedChessSceneBinding({
      persistence: createChessGamePersistence({ storage }),
    })
    const restoredGame = secondBinding.getGame()

    expect(restoredGame.turn).toBe('white')
    expect(restoredGame.history).toHaveLength(2)
    expect(restoredGame.history[1]?.input).toMatchObject({
      from: 'e7',
      to: 'e5',
    })
    expect(
      restoredGame.pieces.find(
        (piece) =>
          piece.square === 'e4' &&
          piece.color === 'white' &&
          piece.type === 'pawn',
      ),
    ).toBeDefined()
    expect(
      restoredGame.pieces.find(
        (piece) =>
          piece.square === 'e5' &&
          piece.color === 'black' &&
          piece.type === 'pawn',
      ),
    ).toBeDefined()
  })

  it('restarts back to a fresh game and clears the saved local session', () => {
    const storage = createMemoryStorage()
    const firstBinding = createPersistedChessSceneBinding({
      persistence: createChessGamePersistence({ storage }),
    })

    firstBinding.move({ from: 'e2', to: 'e4' })
    firstBinding.move({ from: 'e7', to: 'e5' })

    const restoredBinding = createPersistedChessSceneBinding({
      persistence: createChessGamePersistence({ storage }),
    })

    restoredBinding.restart()

    expect(storage.getItem(CHESS_LOCAL_GAME_STORAGE_KEY)).toBeNull()

    const restartedBinding = createPersistedChessSceneBinding({
      persistence: createChessGamePersistence({ storage }),
    })
    const restartedGame = restartedBinding.getGame()

    expect(storage.getItem(CHESS_LOCAL_GAME_STORAGE_KEY)).toBeNull()
    expect(restartedGame.turn).toBe('white')
    expect(restartedGame.history).toHaveLength(0)
    expect(
      restartedGame.pieces.find(
        (piece) =>
          piece.square === 'e2' &&
          piece.color === 'white' &&
          piece.type === 'pawn',
      ),
    ).toBeDefined()
    expect(
      restartedGame.pieces.find(
        (piece) =>
          piece.square === 'e7' &&
          piece.color === 'black' &&
          piece.type === 'pawn',
      ),
    ).toBeDefined()
    expect(
      restartedGame.pieces.find((piece) => piece.square === 'e4'),
    ).toBeUndefined()
    expect(
      restartedGame.pieces.find((piece) => piece.square === 'e5'),
    ).toBeUndefined()
  })
})
