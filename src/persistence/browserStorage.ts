export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function resolveBrowserStorage(
  storage: StorageLike | null | undefined = resolveWindowLocalStorage(),
): StorageLike | null {
  return storage ?? null
}

export function loadStoredJsonValue<T>(
  storage: StorageLike | null | undefined,
  key: string,
  read: (value: unknown) => T | null,
): T | null {
  const resolvedStorage = resolveBrowserStorage(storage)

  if (resolvedStorage === null) {
    return null
  }

  const rawValue = resolvedStorage.getItem(key)

  if (rawValue === null) {
    return null
  }

  try {
    return read(JSON.parse(rawValue))
  } catch {
    return null
  }
}

export function saveStoredJsonValue(
  storage: StorageLike | null | undefined,
  key: string,
  value: unknown,
): void {
  const resolvedStorage = resolveBrowserStorage(storage)

  if (resolvedStorage === null) {
    return
  }

  resolvedStorage.setItem(key, JSON.stringify(value))
}

export function clearStoredJsonValue(
  storage: StorageLike | null | undefined,
  key: string,
): void {
  const resolvedStorage = resolveBrowserStorage(storage)

  if (resolvedStorage === null) {
    return
  }

  resolvedStorage.removeItem(key)
}

function resolveWindowLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}
