import {
  cloneCastlingRights,
  coordinatesToSquare,
  oppositeColor,
  parseSquare,
  squareToCoordinates,
} from '../domain/chessboard'
import {
  CHESS_FILES,
  CHESS_RANKS,
  type CastlingRightsByColor,
  type ChessGameOptions,
  type ChessGameState,
  type ChessMoveRecord,
  type ChessPiece,
  type ChessPiecePlacement,
  type ChessPositionState,
  type ChessPositionSnapshot,
  type ChessSquare,
  type GameStatus,
  type LegalMove,
  type MoveInput,
  type PieceColor,
  type PieceType,
  type PromotionPieceType,
} from '../types/chess'

export type ChessSearchBoardState = Partial<Record<ChessSquare, ChessPiece>>

export interface ChessSearchPosition {
  board: ChessSearchBoardState
  turn: PieceColor
  castlingRights: CastlingRightsByColor
  enPassantTarget: ChessSquare | null
  halfmoveClock: number
  fullmoveNumber: number
}

type BoardState = ChessSearchBoardState

interface SearchPositionInternals {
  orderedSquares: ChessSquare[]
  kingSquares: Record<PieceColor, ChessSquare>
}

interface InternalPosition extends ChessSearchPosition, SearchPositionInternals {}

interface BaseMove {
  from: ChessSquare
  to: ChessSquare
  piece: ChessPiece
  capturedPiece: ChessPiece | null
  promotion: PromotionPieceType | null
  isCapture: boolean
  isCastling: boolean
  isEnPassant: boolean
  rookFrom: ChessSquare | null
  rookTo: ChessSquare | null
}

const BACK_RANK_ORDER: PieceType[] = [
  'rook',
  'knight',
  'bishop',
  'queen',
  'king',
  'bishop',
  'knight',
  'rook',
]

const PROMOTION_PIECES: PromotionPieceType[] = [
  'queen',
  'rook',
  'bishop',
  'knight',
]

const KING_DELTAS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const

const KNIGHT_DELTAS = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
] as const

const BISHOP_DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const

const ROOK_DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const

const QUEEN_DIRECTIONS = [...BISHOP_DIRECTIONS, ...ROOK_DIRECTIONS] as const

export function createChessGame(
  options: ChessGameOptions = {},
): ChessGameState {
  const pieces = options.pieces ?? createStartingPieces()
  const board = boardFromPieces(pieces)
  const castlingRights = normalizeCastlingRights(board, options.castlingRights)
  const position: InternalPosition = {
    board,
    turn: options.turn ?? 'white',
    castlingRights,
    enPassantTarget:
      options.enPassantTarget === undefined || options.enPassantTarget === null
        ? null
        : parseSquare(options.enPassantTarget),
    halfmoveClock: options.halfmoveClock ?? 0,
    fullmoveNumber: options.fullmoveNumber ?? 1,
    orderedSquares: createOrderedSquares(pieces.map((piece) => piece.square)),
    kingSquares: createKingSquares(board),
  }

  return {
    ...createSnapshot(position),
    history: [],
  }
}

export function generateLegalMoves(
  game: ChessPositionState,
  square?: string,
): LegalMove[] {
  const position = toInternalPosition(game)
  const targetSquare = square === undefined ? undefined : parseSquare(square)

  return generateLegalMovesInternal(position, targetSquare, true)
}

export function generateSearchLegalMoves(
  game: ChessPositionState,
  square?: string,
): LegalMove[] {
  return generateSearchLegalMovesFromPosition(createSearchPosition(game), square)
}

export function makeMove(
  game: ChessGameState,
  input: MoveInput,
): ChessGameState {
  const from = parseSquare(input.from)
  const to = parseSquare(input.to)
  const legalMoves = generateLegalMoves(game, from)
  const move = resolveRequestedMove(legalMoves, to, input.promotion)

  if (move === null) {
    throw new Error(`Illegal move: ${input.from} to ${input.to}`)
  }

  const position = toInternalPosition(game)
  const nextPosition = applyMoveToPosition(position, move)
  const before = stripHistory(game)
  const after = createSnapshot(nextPosition)
  const record: ChessMoveRecord = {
    index: game.history.length + 1,
    input: {
      from,
      to,
      ...(move.promotion === null ? {} : { promotion: move.promotion }),
    },
    move,
    before,
    after,
  }

  return {
    ...after,
    history: [...game.history, record],
  }
}

export function applyLegalMove(
  game: ChessPositionState,
  move: LegalMove,
): ChessGameState {
  const nextPosition = applyMoveToPosition(toInternalPosition(game), move)

  return {
    ...createSnapshot(nextPosition),
    history: [],
  }
}

export function applyLegalMoveState(
  game: ChessPositionState,
  move: LegalMove,
): ChessPositionState {
  return createPositionState(applyMoveToPosition(toInternalPosition(game), move))
}

export function getPieceAtSquare(
  game: ChessGameState,
  square: string,
): ChessPiece | null {
  try {
    const parsedSquare = parseSquare(square)
    return toInternalPosition(game).board[parsedSquare] ?? null
  } catch {
    return null
  }
}

export function isInCheck(game: ChessPositionState, color: PieceColor): boolean {
  return isSearchPositionInCheck(createSearchPosition(game), color)
}

export function createSearchPosition(
  game: ChessPositionState,
): ChessSearchPosition {
  return toInternalPosition(game)
}

export function generateSearchLegalMovesFromPosition(
  position: ChessSearchPosition,
  square?: string,
): LegalMove[] {
  const targetSquare = square === undefined ? undefined : parseSquare(square)

  return generateLegalMovesInternal(
    toInternalSearchPosition(position),
    targetSquare,
    false,
  )
}

export function applySearchMove(
  position: ChessSearchPosition,
  move: LegalMove,
): ChessSearchPosition {
  return applyMoveToPosition(toInternalSearchPosition(position), move)
}

export function isSearchPositionInCheck(
  position: ChessSearchPosition,
  color: PieceColor,
): boolean {
  return isKingInCheck(toInternalSearchPosition(position), color)
}

export function replayGameHistory(
  game: ChessGameState,
): ChessPositionSnapshot[] {
  if (game.history.length === 0) {
    return [stripHistory(game)]
  }

  return [game.history[0]!.before, ...game.history.map((record) => record.after)]
}

function createStartingPieces(): ChessPiecePlacement[] {
  return [
    ...buildBackRank('white', '1'),
    ...buildPawnRank('white', '2'),
    ...buildPawnRank('black', '7'),
    ...buildBackRank('black', '8'),
  ]
}

function buildBackRank(
  color: PieceColor,
  rank: (typeof CHESS_RANKS)[number],
): ChessPiecePlacement[] {
  return CHESS_FILES.map((file, index) => ({
    square: `${file}${rank}` as ChessSquare,
    color,
    type: BACK_RANK_ORDER[index]!,
  }))
}

function buildPawnRank(
  color: PieceColor,
  rank: (typeof CHESS_RANKS)[number],
): ChessPiecePlacement[] {
  return CHESS_FILES.map((file) => ({
    square: `${file}${rank}` as ChessSquare,
    color,
    type: 'pawn',
  }))
}

function boardFromPieces(pieces: ChessPiecePlacement[]): BoardState {
  const board: BoardState = {}

  for (const piece of pieces) {
    if (board[piece.square] !== undefined) {
      throw new Error(`Multiple pieces cannot occupy ${piece.square}`)
    }

    board[piece.square] = {
      color: piece.color,
      type: piece.type,
    }
  }

  return board
}

function normalizeCastlingRights(
  board: BoardState,
  overrides?: ChessGameOptions['castlingRights'],
): CastlingRightsByColor {
  const derived = deriveCastlingRights(board)

  return {
    white: {
      kingSide: overrides?.white?.kingSide ?? derived.white.kingSide,
      queenSide: overrides?.white?.queenSide ?? derived.white.queenSide,
    },
    black: {
      kingSide: overrides?.black?.kingSide ?? derived.black.kingSide,
      queenSide: overrides?.black?.queenSide ?? derived.black.queenSide,
    },
  }
}

function deriveCastlingRights(board: BoardState): CastlingRightsByColor {
  return {
    white: {
      kingSide:
        hasPiece(board, 'e1', 'white', 'king') &&
        hasPiece(board, 'h1', 'white', 'rook'),
      queenSide:
        hasPiece(board, 'e1', 'white', 'king') &&
        hasPiece(board, 'a1', 'white', 'rook'),
    },
    black: {
      kingSide:
        hasPiece(board, 'e8', 'black', 'king') &&
        hasPiece(board, 'h8', 'black', 'rook'),
      queenSide:
        hasPiece(board, 'e8', 'black', 'king') &&
        hasPiece(board, 'a8', 'black', 'rook'),
    },
  }
}

function hasPiece(
  board: BoardState,
  square: ChessSquare,
  color: PieceColor,
  type: PieceType,
): boolean {
  const piece = board[square]

  return piece?.color === color && piece.type === type
}

function toInternalPosition(position: ChessPositionState): InternalPosition {
  const board = boardFromPieces(position.pieces)

  return {
    board,
    turn: position.turn,
    castlingRights: cloneCastlingRights(position.castlingRights),
    enPassantTarget: position.enPassantTarget,
    halfmoveClock: position.halfmoveClock,
    fullmoveNumber: position.fullmoveNumber,
    orderedSquares: createOrderedSquares(position.pieces.map((piece) => piece.square)),
    kingSquares: createKingSquares(board),
  }
}

function createPositionState(position: InternalPosition): ChessPositionState {
  return {
    pieces: piecesFromPosition(position),
    turn: position.turn,
    castlingRights: cloneCastlingRights(position.castlingRights),
    enPassantTarget: position.enPassantTarget,
    halfmoveClock: position.halfmoveClock,
    fullmoveNumber: position.fullmoveNumber,
  }
}

function stripHistory(game: ChessGameState): ChessPositionSnapshot {
  return {
    pieces: game.pieces.map((piece) => ({ ...piece })),
    turn: game.turn,
    castlingRights: cloneCastlingRights(game.castlingRights),
    enPassantTarget: game.enPassantTarget,
    halfmoveClock: game.halfmoveClock,
    fullmoveNumber: game.fullmoveNumber,
    status: game.status,
    checkedColor: game.checkedColor,
    winner: game.winner,
  }
}

function createSnapshot(position: InternalPosition): ChessPositionSnapshot {
  const checkedColor = isKingInCheck(position, position.turn)
    ? position.turn
    : null
  const legalMoveCount = generateLegalMovesInternal(position, undefined, false)
    .length
  let status: GameStatus = 'active'

  if (legalMoveCount === 0) {
    status = checkedColor === null ? 'stalemate' : 'checkmate'
  } else if (checkedColor !== null) {
    status = 'check'
  }

  return {
    ...createPositionState(position),
    status,
    checkedColor,
    winner: status === 'checkmate' ? oppositeColor(position.turn) : null,
  }
}

function toInternalSearchPosition(
  position: ChessSearchPosition,
): InternalPosition {
  const maybeInternal = position as Partial<InternalPosition>

  if (
    maybeInternal.orderedSquares !== undefined &&
    maybeInternal.kingSquares !== undefined
  ) {
    return maybeInternal as InternalPosition
  }

  return {
    ...position,
    orderedSquares: createOrderedSquaresFromBoard(position.board),
    kingSquares: createKingSquares(position.board),
  }
}

function piecesFromPosition(position: InternalPosition): ChessPiecePlacement[] {
  return position.orderedSquares.map((square) => ({
    square,
    color: position.board[square]!.color,
    type: position.board[square]!.type,
  }))
}

function resolveRequestedMove(
  legalMoves: LegalMove[],
  to: ChessSquare,
  promotion?: PromotionPieceType,
): LegalMove | null {
  const matchingMoves = legalMoves.filter((move) => move.to === to)

  if (matchingMoves.length === 0) {
    return null
  }

  if (promotion !== undefined) {
    return matchingMoves.find((move) => move.promotion === promotion) ?? null
  }

  return (
    matchingMoves.find((move) => move.promotion === null) ??
    matchingMoves.find((move) => move.promotion === 'queen') ??
    matchingMoves[0] ??
    null
  )
}

function generateLegalMovesInternal(
  position: InternalPosition,
  square?: ChessSquare,
  annotateOutcome = true,
): LegalMove[] {
  const candidateMoves = square
    ? generateMovesForSquare(position, square)
    : generateMovesForTurn(position)
  const legalMoves: LegalMove[] = []

  for (const candidate of candidateMoves) {
    const nextPosition = applyMoveToPosition(position, candidate)

    if (isKingInCheck(nextPosition, position.turn)) {
      continue
    }

    if (!annotateOutcome) {
      legalMoves.push({
        ...candidate,
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
      })
      continue
    }

    const opponentInCheck = isKingInCheck(nextPosition, nextPosition.turn)
    const opponentMoves = generateLegalMovesInternal(
      nextPosition,
      undefined,
      false,
    ).length

    legalMoves.push({
      ...candidate,
      isCheck: opponentInCheck,
      isCheckmate: opponentInCheck && opponentMoves === 0,
      isStalemate: !opponentInCheck && opponentMoves === 0,
    })
  }

  return legalMoves
}

function generateMovesForTurn(position: InternalPosition): BaseMove[] {
  const moves: BaseMove[] = []

  for (const square of position.orderedSquares) {
    const piece = position.board[square]

    if (piece === undefined || piece.color !== position.turn) {
      continue
    }

    moves.push(...generateMovesForPiece(position, square, piece))
  }

  return moves
}

function generateMovesForSquare(
  position: InternalPosition,
  square: ChessSquare,
): BaseMove[] {
  const piece = position.board[square]

  if (piece === undefined || piece.color !== position.turn) {
    return []
  }

  return generateMovesForPiece(position, square, piece)
}

function generateMovesForPiece(
  position: InternalPosition,
  from: ChessSquare,
  piece: ChessPiece,
): BaseMove[] {
  switch (piece.type) {
    case 'pawn':
      return generatePawnMoves(position, from, piece)
    case 'knight':
      return generateKnightMoves(position, from, piece)
    case 'bishop':
      return generateSlidingMoves(position, from, piece, BISHOP_DIRECTIONS)
    case 'rook':
      return generateSlidingMoves(position, from, piece, ROOK_DIRECTIONS)
    case 'queen':
      return generateSlidingMoves(position, from, piece, QUEEN_DIRECTIONS)
    case 'king':
      return generateKingMoves(position, from, piece)
  }
}

function generatePawnMoves(
  position: InternalPosition,
  from: ChessSquare,
  piece: ChessPiece,
): BaseMove[] {
  const moves: BaseMove[] = []
  const { fileIndex, rankIndex } = squareToCoordinates(from)
  const direction = piece.color === 'white' ? 1 : -1
  const startRankIndex = piece.color === 'white' ? 1 : 6
  const promotionRankIndex = piece.color === 'white' ? 7 : 0
  const forwardSquare = coordinatesToSquare(fileIndex, rankIndex + direction)

  if (
    forwardSquare !== null &&
    position.board[forwardSquare] === undefined
  ) {
    pushPawnMove(moves, {
      from,
      to: forwardSquare,
      piece,
      capturedPiece: null,
      promotion:
        squareToCoordinates(forwardSquare).rankIndex === promotionRankIndex
          ? 'queen'
          : null,
      isCapture: false,
      isCastling: false,
      isEnPassant: false,
      rookFrom: null,
      rookTo: null,
    })

    const doubleForwardSquare = coordinatesToSquare(
      fileIndex,
      rankIndex + direction * 2,
    )

    if (
      rankIndex === startRankIndex &&
      doubleForwardSquare !== null &&
      position.board[doubleForwardSquare] === undefined
    ) {
      moves.push({
        from,
        to: doubleForwardSquare,
        piece,
        capturedPiece: null,
        promotion: null,
        isCapture: false,
        isCastling: false,
        isEnPassant: false,
        rookFrom: null,
        rookTo: null,
      })
    }
  }

  for (const fileOffset of [-1, 1] as const) {
    const targetSquare = coordinatesToSquare(
      fileIndex + fileOffset,
      rankIndex + direction,
    )

    if (targetSquare === null) {
      continue
    }

    const capturedPiece = position.board[targetSquare]

    if (
      capturedPiece !== undefined &&
      capturedPiece.color !== piece.color &&
      capturedPiece.type !== 'king'
    ) {
      pushPawnMove(moves, {
        from,
        to: targetSquare,
        piece,
        capturedPiece,
        promotion:
          squareToCoordinates(targetSquare).rankIndex === promotionRankIndex
            ? 'queen'
            : null,
        isCapture: true,
        isCastling: false,
        isEnPassant: false,
        rookFrom: null,
        rookTo: null,
      })
      continue
    }

    if (targetSquare !== position.enPassantTarget) {
      continue
    }

    const capturedSquare = coordinatesToSquare(fileIndex + fileOffset, rankIndex)

    if (capturedSquare === null) {
      continue
    }

    const enPassantPiece = position.board[capturedSquare]

    if (
      enPassantPiece?.color === oppositeColor(piece.color) &&
      enPassantPiece.type === 'pawn'
    ) {
      moves.push({
        from,
        to: targetSquare,
        piece,
        capturedPiece: enPassantPiece,
        promotion: null,
        isCapture: true,
        isCastling: false,
        isEnPassant: true,
        rookFrom: null,
        rookTo: null,
      })
    }
  }

  return moves
}

function pushPawnMove(moves: BaseMove[], move: BaseMove): void {
  if (move.promotion === null) {
    moves.push(move)
    return
  }

  for (const promotionPiece of PROMOTION_PIECES) {
    moves.push({
      ...move,
      promotion: promotionPiece,
    })
  }
}

function generateKnightMoves(
  position: InternalPosition,
  from: ChessSquare,
  piece: ChessPiece,
): BaseMove[] {
  const moves: BaseMove[] = []
  const { fileIndex, rankIndex } = squareToCoordinates(from)

  for (const [fileDelta, rankDelta] of KNIGHT_DELTAS) {
    const to = coordinatesToSquare(fileIndex + fileDelta, rankIndex + rankDelta)

    if (to === null) {
      continue
    }

    const targetPiece = position.board[to]

    if (targetPiece?.color === piece.color || targetPiece?.type === 'king') {
      continue
    }

    moves.push({
      from,
      to,
      piece,
      capturedPiece: targetPiece ?? null,
      promotion: null,
      isCapture: targetPiece !== undefined,
      isCastling: false,
      isEnPassant: false,
      rookFrom: null,
      rookTo: null,
    })
  }

  return moves
}

function generateSlidingMoves(
  position: InternalPosition,
  from: ChessSquare,
  piece: ChessPiece,
  directions: readonly (readonly [number, number])[],
): BaseMove[] {
  const moves: BaseMove[] = []
  const { fileIndex, rankIndex } = squareToCoordinates(from)

  for (const [fileDelta, rankDelta] of directions) {
    let nextFile = fileIndex + fileDelta
    let nextRank = rankIndex + rankDelta

    while (true) {
      const to = coordinatesToSquare(nextFile, nextRank)

      if (to === null) {
        break
      }

      const targetPiece = position.board[to]

      if (targetPiece === undefined) {
        moves.push({
          from,
          to,
          piece,
          capturedPiece: null,
          promotion: null,
          isCapture: false,
          isCastling: false,
          isEnPassant: false,
          rookFrom: null,
          rookTo: null,
        })
      } else {
        if (targetPiece.color !== piece.color && targetPiece.type !== 'king') {
          moves.push({
            from,
            to,
            piece,
            capturedPiece: targetPiece,
            promotion: null,
            isCapture: true,
            isCastling: false,
            isEnPassant: false,
            rookFrom: null,
            rookTo: null,
          })
        }

        break
      }

      nextFile += fileDelta
      nextRank += rankDelta
    }
  }

  return moves
}

function generateKingMoves(
  position: InternalPosition,
  from: ChessSquare,
  piece: ChessPiece,
): BaseMove[] {
  const moves: BaseMove[] = []
  const { fileIndex, rankIndex } = squareToCoordinates(from)

  for (const [fileDelta, rankDelta] of KING_DELTAS) {
    const to = coordinatesToSquare(fileIndex + fileDelta, rankIndex + rankDelta)

    if (to === null) {
      continue
    }

    const targetPiece = position.board[to]

    if (targetPiece?.color === piece.color || targetPiece?.type === 'king') {
      continue
    }

    moves.push({
      from,
      to,
      piece,
      capturedPiece: targetPiece ?? null,
      promotion: null,
      isCapture: targetPiece !== undefined,
      isCastling: false,
      isEnPassant: false,
      rookFrom: null,
      rookTo: null,
    })
  }

  return [...moves, ...generateCastlingMoves(position, from, piece)]
}

function generateCastlingMoves(
  position: InternalPosition,
  from: ChessSquare,
  piece: ChessPiece,
): BaseMove[] {
  if (isKingInCheck(position, piece.color)) {
    return []
  }

  const moves: BaseMove[] = []
  const backRank = piece.color === 'white' ? '1' : '8'
  const opponent = oppositeColor(piece.color)

  if (from !== (`e${backRank}` as ChessSquare)) {
    return []
  }

  const rights = position.castlingRights[piece.color]

  if (rights.kingSide) {
    const throughSquare = `f${backRank}` as ChessSquare
    const to = `g${backRank}` as ChessSquare
    const rookSquare = `h${backRank}` as ChessSquare

    if (
      hasPiece(position.board, rookSquare, piece.color, 'rook') &&
      position.board[throughSquare] === undefined &&
      position.board[to] === undefined &&
      !isSquareAttacked(position, throughSquare, opponent) &&
      !isSquareAttacked(position, to, opponent)
    ) {
      moves.push({
        from,
        to,
        piece,
        capturedPiece: null,
        promotion: null,
        isCapture: false,
        isCastling: true,
        isEnPassant: false,
        rookFrom: rookSquare,
        rookTo: `f${backRank}` as ChessSquare,
      })
    }
  }

  if (rights.queenSide) {
    const throughSquare = `d${backRank}` as ChessSquare
    const to = `c${backRank}` as ChessSquare
    const extraEmptySquare = `b${backRank}` as ChessSquare
    const rookSquare = `a${backRank}` as ChessSquare

    if (
      hasPiece(position.board, rookSquare, piece.color, 'rook') &&
      position.board[throughSquare] === undefined &&
      position.board[to] === undefined &&
      position.board[extraEmptySquare] === undefined &&
      !isSquareAttacked(position, throughSquare, opponent) &&
      !isSquareAttacked(position, to, opponent)
    ) {
      moves.push({
        from,
        to,
        piece,
        capturedPiece: null,
        promotion: null,
        isCapture: false,
        isCastling: true,
        isEnPassant: false,
        rookFrom: rookSquare,
        rookTo: `d${backRank}` as ChessSquare,
      })
    }
  }

  return moves
}

function applyMoveToPosition(
  position: InternalPosition,
  move: BaseMove,
): InternalPosition {
  const board: BoardState = { ...position.board }
  const movingPiece = board[move.from]

  if (movingPiece === undefined) {
    throw new Error(`No piece on ${move.from}`)
  }

  delete board[move.from]

  if (move.isEnPassant) {
    const { fileIndex } = squareToCoordinates(move.to)
    const { rankIndex } = squareToCoordinates(move.from)
    const capturedSquare = coordinatesToSquare(fileIndex, rankIndex)

    if (capturedSquare !== null) {
      delete board[capturedSquare]
    }
  } else if (move.capturedPiece !== null) {
    delete board[move.to]
  }

  if (move.isCastling && move.rookFrom !== null && move.rookTo !== null) {
    const rook = board[move.rookFrom]

    if (rook !== undefined) {
      delete board[move.rookFrom]
      board[move.rookTo] = rook
    }
  }

  board[move.to] =
    move.promotion === null
      ? movingPiece
      : {
          color: movingPiece.color,
          type: move.promotion,
        }

  const castlingRights = updateCastlingRights(position.castlingRights, move)
  const kingSquares = { ...position.kingSquares }

  if (move.piece.type === 'king') {
    kingSquares[move.piece.color] = move.to
  }

  return {
    board,
    turn: oppositeColor(position.turn),
    castlingRights,
    enPassantTarget: getEnPassantTarget(move),
    halfmoveClock:
      move.piece.type === 'pawn' || move.isCapture
        ? 0
        : position.halfmoveClock + 1,
    fullmoveNumber:
      position.turn === 'black'
        ? position.fullmoveNumber + 1
        : position.fullmoveNumber,
    orderedSquares: updateOrderedSquares(position, move),
    kingSquares,
  }
}

function updateCastlingRights(
  rights: CastlingRightsByColor,
  move: BaseMove,
): CastlingRightsByColor {
  const nextRights = cloneCastlingRights(rights)

  if (move.piece.type === 'king') {
    nextRights[move.piece.color] = {
      kingSide: false,
      queenSide: false,
    }
  }

  if (move.piece.type === 'rook') {
    disableRookCastling(nextRights, move.piece.color, move.from)
  }

  if (move.capturedPiece?.type === 'rook') {
    disableRookCastling(nextRights, move.capturedPiece.color, move.to)
  }

  return nextRights
}

function disableRookCastling(
  rights: CastlingRightsByColor,
  color: PieceColor,
  square: ChessSquare,
): void {
  if (color === 'white') {
    if (square === 'a1') {
      rights.white.queenSide = false
    } else if (square === 'h1') {
      rights.white.kingSide = false
    }
    return
  }

  if (square === 'a8') {
    rights.black.queenSide = false
  } else if (square === 'h8') {
    rights.black.kingSide = false
  }
}

function getEnPassantTarget(move: BaseMove): ChessSquare | null {
  if (move.piece.type !== 'pawn') {
    return null
  }

  const fromCoordinates = squareToCoordinates(move.from)
  const toCoordinates = squareToCoordinates(move.to)

  if (Math.abs(toCoordinates.rankIndex - fromCoordinates.rankIndex) !== 2) {
    return null
  }

  return coordinatesToSquare(
    fromCoordinates.fileIndex,
    (fromCoordinates.rankIndex + toCoordinates.rankIndex) / 2,
  )
}

function isKingInCheck(
  position: InternalPosition,
  color: PieceColor,
): boolean {
  return isSquareAttacked(
    position,
    position.kingSquares[color],
    oppositeColor(color),
  )
}

function isSquareAttacked(
  position: InternalPosition,
  square: ChessSquare,
  byColor: PieceColor,
): boolean {
  const { fileIndex, rankIndex } = squareToCoordinates(square)
  const pawnSourceRank = byColor === 'white' ? rankIndex - 1 : rankIndex + 1

  for (const fileOffset of [-1, 1] as const) {
    const sourceSquare = coordinatesToSquare(
      fileIndex + fileOffset,
      pawnSourceRank,
    )

    if (
      sourceSquare !== null &&
      hasPiece(position.board, sourceSquare, byColor, 'pawn')
    ) {
      return true
    }
  }

  for (const [fileDelta, rankDelta] of KNIGHT_DELTAS) {
    const sourceSquare = coordinatesToSquare(
      fileIndex + fileDelta,
      rankIndex + rankDelta,
    )

    if (
      sourceSquare !== null &&
      hasPiece(position.board, sourceSquare, byColor, 'knight')
    ) {
      return true
    }
  }

  for (const [fileDelta, rankDelta] of KING_DELTAS) {
    const sourceSquare = coordinatesToSquare(
      fileIndex + fileDelta,
      rankIndex + rankDelta,
    )

    if (
      sourceSquare !== null &&
      hasPiece(position.board, sourceSquare, byColor, 'king')
    ) {
      return true
    }
  }

  return (
    isAttackedBySlidingPiece(
      position.board,
      square,
      byColor,
      BISHOP_DIRECTIONS,
      ['bishop', 'queen'],
    ) ||
    isAttackedBySlidingPiece(
      position.board,
      square,
      byColor,
      ROOK_DIRECTIONS,
      ['rook', 'queen'],
    )
  )
}

function isAttackedBySlidingPiece(
  board: BoardState,
  square: ChessSquare,
  byColor: PieceColor,
  directions: readonly (readonly [number, number])[],
  validTypes: readonly PieceType[],
): boolean {
  const { fileIndex, rankIndex } = squareToCoordinates(square)

  for (const [fileDelta, rankDelta] of directions) {
    let nextFile = fileIndex + fileDelta
    let nextRank = rankIndex + rankDelta

    while (true) {
      const sourceSquare = coordinatesToSquare(nextFile, nextRank)

      if (sourceSquare === null) {
        break
      }

      const piece = board[sourceSquare]

      if (piece !== undefined) {
        if (piece.color === byColor && validTypes.includes(piece.type)) {
          return true
        }

        break
      }

      nextFile += fileDelta
      nextRank += rankDelta
    }
  }

  return false
}

function createOrderedSquares(squares: ChessSquare[]): ChessSquare[] {
  return [...squares].sort(compareSquaresInBoardOrder)
}

function createOrderedSquaresFromBoard(board: BoardState): ChessSquare[] {
  return createOrderedSquares(Object.keys(board) as ChessSquare[])
}

function compareSquaresInBoardOrder(
  left: ChessSquare,
  right: ChessSquare,
): number {
  return left.charCodeAt(1) - right.charCodeAt(1) ||
    left.charCodeAt(0) - right.charCodeAt(0)
}

function createKingSquares(
  board: BoardState,
): Record<PieceColor, ChessSquare> {
  return {
    white: findPieceSquare(board, 'white', 'king'),
    black: findPieceSquare(board, 'black', 'king'),
  }
}

function findPieceSquare(
  board: BoardState,
  color: PieceColor,
  type: PieceType,
): ChessSquare {
  for (const square of Object.keys(board) as ChessSquare[]) {
    const piece = board[square]

    if (piece?.color === color && piece.type === type) {
      return square
    }
  }

  throw new Error(`Missing ${color} ${type}`)
}

function updateOrderedSquares(
  position: InternalPosition,
  move: BaseMove,
): ChessSquare[] {
  const removedSquares = new Set<ChessSquare>([move.from])

  if (move.isEnPassant) {
    const { fileIndex } = squareToCoordinates(move.to)
    const { rankIndex } = squareToCoordinates(move.from)
    const capturedSquare = coordinatesToSquare(fileIndex, rankIndex)

    if (capturedSquare !== null) {
      removedSquares.add(capturedSquare)
    }
  } else if (move.capturedPiece !== null) {
    removedSquares.add(move.to)
  }

  if (move.isCastling && move.rookFrom !== null) {
    removedSquares.add(move.rookFrom)
  }

  const nextSquares = position.orderedSquares.filter(
    (square) => !removedSquares.has(square),
  )

  nextSquares.push(move.to)

  if (move.isCastling && move.rookTo !== null) {
    nextSquares.push(move.rookTo)
  }

  return createOrderedSquares(nextSquares)
}
