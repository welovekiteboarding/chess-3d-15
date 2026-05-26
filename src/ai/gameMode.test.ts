import { describe, expect, it } from 'vitest'
import {
  createChessAiMatchSettings,
  describeChessAiMatchSettings,
  isHumanVsAiMode,
  setChessAiDifficulty,
  setChessAiMode,
} from './gameMode'

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
})
