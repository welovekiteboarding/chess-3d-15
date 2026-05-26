import { describe, expect, it } from 'vitest'
import {
  clearStoredJsonValue,
  loadStoredJsonValue,
  saveStoredJsonValue,
  type StorageLike,
} from './browserStorage'

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

describe('browserStorage', () => {
  it('saves and loads JSON payloads through the injected storage', () => {
    const storage = createMemoryStorage()

    saveStoredJsonValue(storage, 'current-game', {
      version: 1,
      value: 'e2-e4',
    })

    expect(
      loadStoredJsonValue(storage, 'current-game', (value) => value),
    ).toEqual({
      version: 1,
      value: 'e2-e4',
    })
  })

  it('returns null when the stored JSON is malformed', () => {
    const storage = createMemoryStorage()

    storage.setItem('current-game', '{')

    expect(
      loadStoredJsonValue(storage, 'current-game', (value) => value),
    ).toBeNull()
  })

  it('clears a stored key', () => {
    const storage = createMemoryStorage()

    saveStoredJsonValue(storage, 'current-game', {
      version: 1,
      value: 'e2-e4',
    })
    clearStoredJsonValue(storage, 'current-game')

    expect(storage.getItem('current-game')).toBeNull()
  })
})
