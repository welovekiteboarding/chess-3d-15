import { resolveChessPositionSnapshot } from '../chess/engine'
import { describeChessSceneStatus } from '../domain/chessScene'
import type { AiDifficulty } from '../types/ai'
import type { ChessPositionState, PieceColor } from '../types/chess'

export type ChessGameMode = 'human-vs-human' | 'human-vs-ai'

export interface ChessAiMatchSettings {
  mode: ChessGameMode
  difficulty: AiDifficulty
}

export interface ChessAiMatchSettingsDescription {
  modeLabel: string
  difficultyLabel: string
  statusLabel: string
  statusDetail: string
}

export interface DescribeChessAiMatchSettingsOptions {
  isThinking?: boolean
  game?: ChessPositionState
  aiColor?: PieceColor
}

export const CHESS_GAME_MODE_OPTIONS: readonly ChessGameMode[] = [
  'human-vs-human',
  'human-vs-ai',
]

export const CHESS_AI_DIFFICULTY_OPTIONS: readonly AiDifficulty[] = [
  'easy',
  'medium',
  'hard',
]

export const DEFAULT_CHESS_AI_MATCH_SETTINGS: ChessAiMatchSettings = {
  mode: 'human-vs-human',
  difficulty: 'medium',
}

const CHESS_GAME_MODE_LABELS: Record<ChessGameMode, string> = {
  'human-vs-human': 'Human vs Human',
  'human-vs-ai': 'Human vs AI',
}

const CHESS_AI_DIFFICULTY_LABELS: Record<AiDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}
const DEFAULT_CHESS_AI_COLOR: PieceColor = 'black'

export function createChessAiMatchSettings(
  overrides: Partial<ChessAiMatchSettings> = {},
): ChessAiMatchSettings {
  return {
    ...DEFAULT_CHESS_AI_MATCH_SETTINGS,
    ...overrides,
  }
}

export function setChessAiMode(
  settings: ChessAiMatchSettings,
  mode: ChessGameMode,
): ChessAiMatchSettings {
  if (settings.mode === mode) {
    return settings
  }

  return {
    ...settings,
    mode,
  }
}

export function setChessAiDifficulty(
  settings: ChessAiMatchSettings,
  difficulty: AiDifficulty,
): ChessAiMatchSettings {
  if (settings.difficulty === difficulty) {
    return settings
  }

  return {
    ...settings,
    difficulty,
  }
}

export function isHumanVsAiMode(settings: ChessAiMatchSettings): boolean {
  return settings.mode === 'human-vs-ai'
}

export function describeChessAiMatchSettings(
  settings: ChessAiMatchSettings,
  options: DescribeChessAiMatchSettingsOptions = {},
): ChessAiMatchSettingsDescription {
  const modeLabel = CHESS_GAME_MODE_LABELS[settings.mode]
  const difficultyLabel = CHESS_AI_DIFFICULTY_LABELS[settings.difficulty]

  if (isHumanVsAiMode(settings)) {
    const terminalDescription = describeChessAiTerminalState(
      modeLabel,
      difficultyLabel,
      options.game,
      options.aiColor ?? DEFAULT_CHESS_AI_COLOR,
    )

    if (terminalDescription !== null) {
      return terminalDescription
    }

    if (options.isThinking) {
      return {
        modeLabel,
        difficultyLabel,
        statusLabel: 'AI thinking',
        statusDetail: `${difficultyLabel} difficulty is choosing Black's reply move.`,
      }
    }

    return {
      modeLabel,
      difficultyLabel,
      statusLabel: 'AI opponent ready',
      statusDetail: `${difficultyLabel} difficulty is selected for the human-versus-AI game mode.`,
    }
  }

  return {
    modeLabel,
    difficultyLabel,
    statusLabel: 'Local human play',
    statusDetail: `AI opponent is off. ${difficultyLabel} difficulty stays selected so you can switch into Human vs AI without reconfiguring it.`,
  }
}

function describeChessAiTerminalState(
  modeLabel: string,
  difficultyLabel: string,
  game: ChessPositionState | undefined,
  aiColor: PieceColor,
): ChessAiMatchSettingsDescription | null {
  if (game === undefined) {
    return null
  }

  const resolvedGame = resolveChessPositionSnapshot(game)

  if (
    resolvedGame.status !== 'checkmate' &&
    resolvedGame.status !== 'stalemate' &&
    resolvedGame.status !== 'draw' &&
    resolvedGame.status !== 'resigned'
  ) {
    return null
  }

  const sceneStatus = describeChessSceneStatus(resolvedGame)

  return {
    modeLabel,
    difficultyLabel,
    statusLabel:
      resolvedGame.status === 'checkmate' || resolvedGame.status === 'resigned'
        ? resolvedGame.winner === aiColor
          ? 'AI wins'
          : 'Human wins'
        : sceneStatus.statusLabel,
    statusDetail: sceneStatus.statusDetail,
  }
}
