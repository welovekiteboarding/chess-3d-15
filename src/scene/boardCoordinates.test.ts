import { describe, expect, it } from 'vitest'
import {
  BOARD_SIZE,
  SQUARE_SIZE,
  getSquareColor,
  squareToScenePosition,
} from './boardCoordinates'

describe('boardCoordinates', () => {
  it('maps corner squares to stable scene positions from white perspective', () => {
    expect(squareToScenePosition('a1')).toEqual([-3.5, 0, 3.5])
    expect(squareToScenePosition('h8')).toEqual([3.5, 0, -3.5])
  })

  it('maps center-adjacent squares using the shared square size constant', () => {
    expect(BOARD_SIZE).toBe(8)
    expect(SQUARE_SIZE).toBe(1)
    expect(squareToScenePosition('e4', 0.6)).toEqual([0.5, 0.6, 0.5])
  })

  it('returns alternating light and dark square colors', () => {
    expect(getSquareColor('a1')).toBe('dark')
    expect(getSquareColor('b1')).toBe('light')
    expect(getSquareColor('c8')).toBe('light')
  })
})
