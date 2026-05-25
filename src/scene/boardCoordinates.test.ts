import { describe, expect, it } from 'vitest'
import {
  boardSquareToScenePosition,
  scenePositionToBoardSquare,
} from './boardCoordinates'

describe('boardCoordinates', () => {
  it('maps board squares to centered scene coordinates', () => {
    expect(boardSquareToScenePosition('a1')).toEqual([-3.5, 0, 3.5])
    expect(boardSquareToScenePosition('d4')).toEqual([-0.5, 0, 0.5])
    expect(boardSquareToScenePosition('h8')).toEqual([3.5, 0, -3.5])
  })

  it('supports custom piece elevation when mapping squares', () => {
    expect(boardSquareToScenePosition('e1', 0.66)).toEqual([0.5, 0.66, 3.5])
  })

  it('round-trips centered scene positions back to board squares', () => {
    expect(scenePositionToBoardSquare([-3.5, 0, 3.5])).toBe('a1')
    expect(scenePositionToBoardSquare([0.5, 2, -3.5])).toBe('e8')
    expect(scenePositionToBoardSquare([3.5, -1, -3.5])).toBe('h8')
  })

  it('rejects positions outside the playable board', () => {
    expect(scenePositionToBoardSquare([5, 0, 0])).toBeNull()
    expect(scenePositionToBoardSquare([0, 0, -5])).toBeNull()
  })
})
