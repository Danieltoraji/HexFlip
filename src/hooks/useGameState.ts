// ============================================================
// HexFlip — 游戏状态管理 Hook（useReducer）
// ============================================================

import { useReducer, useCallback, useRef, useEffect } from 'react';
import type {
  GameState,
  GameConfig,
  Board,
  CubeCoord,
  MoveRecord,
  PlayerConfig,
} from '../types/game';
import { DEFAULT_COLORS, DEFAULT_NAMES } from '../types/game';
import { generateHexGrid, coordToKey, coordsEqual } from '../logic/hexGrid';
import {
  initializeBoard,
  executeMove,
  checkWinner,
  hasValidMoves,
  isEliminated,
  getValidMoves,
  cloneBoard,
} from '../logic/gameEngine';
import { getAIMove } from '../logic/ai';

// ---- Actions ----

type GameAction =
  | { type: 'START_GAME'; config: GameConfig }
  | { type: 'SELECT_CELL'; coord: CubeCoord }
  | { type: 'EXECUTE_MOVE'; from: CubeCoord; to: CubeCoord; player: number }
  | { type: 'UNDO' }
  | { type: 'RESET' }
  | { type: 'SET_MESSAGE'; message: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SKIP_TURN' };

// ---- 默认配置 ----

export function createDefaultConfig(): GameConfig {
  return {
    radius: 4,
    fillRatio: 0.6,
    playerCount: 2,
    players: [
      { name: DEFAULT_NAMES[0], color: DEFAULT_COLORS[0], isAI: false, aiDifficulty: 'easy' },
      { name: DEFAULT_NAMES[1], color: DEFAULT_COLORS[1], isAI: false, aiDifficulty: 'easy' },
    ],
    turnOrder: 'clockwise',
  };
}

// ---- 辅助函数 ----

/**
 * 统计有多少玩家拥有合法移动，返回有合法移动的玩家索引集合
 */
function getMovablePlayers(board: Board, config: GameConfig): Set<number> {
  const grid = generateHexGrid(config.radius);
  const movable = new Set<number>();
  for (let i = 0; i < config.players.length; i++) {
    if (hasValidMoves(board, i, grid)) {
      movable.add(i);
    }
  }
  return movable;
}

/**
 * 检查是否只有一方能够活动 → 返回该玩家索引，否则返回 null
 */
function checkSoleSurvivor(board: Board, config: GameConfig): number | null {
  const movable = getMovablePlayers(board, config);
  if (movable.size !== 1) return null;
  // 只有一个元素，直接取第一个
  for (const player of movable) {
    return player;
  }
  return null;
}

/** 找到下一个可行动的玩家（跳过淘汰和无合法移动的玩家） */
function findNextActivePlayer(
  board: Board,
  config: GameConfig,
  currentPlayer: number,
  eliminated: Set<number>,
): { nextPlayer: number; skipped: number[]; allStuck: boolean } {
  const playerCount = config.players.length;
  const order = config.turnOrder;
  const grid = generateHexGrid(config.radius);
  const skipped: number[] = [];
  let next = currentPlayer;
  let attempts = 0;

  while (attempts < playerCount) {
    // 移动到下一个
    next = order === 'clockwise'
      ? (next + 1) % playerCount
      : (next - 1 + playerCount) % playerCount;
    attempts++;

    // 已被淘汰则跳过
    if (eliminated.has(next)) {
      skipped.push(next);
      continue;
    }

    // 检查是否有合法移动
    if (hasValidMoves(board, next, grid)) {
      return { nextPlayer: next, skipped, allStuck: false };
    }

    // 无合法移动，记录跳过
    skipped.push(next);
  }

  // 循环完所有玩家都没找到 → 检查当前玩家是否还有合法移动
  if (hasValidMoves(board, currentPlayer, grid)) {
    // 只有当前玩家能移动，其他人都不能 → 不算 allStuck
    return { nextPlayer: currentPlayer, skipped, allStuck: false };
  }

  return { nextPlayer: currentPlayer, skipped, allStuck: true };
}

// ---- Reducer ----

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const board = initializeBoard(action.config);
      const grid = generateHexGrid(action.config.radius);
      const playerCount = action.config.players.length;

      // 从第一个玩家开始，找到第一个有合法移动的玩家
      let firstPlayer = 0;
      const firstSkipped: number[] = [];

      for (let i = 0; i < playerCount; i++) {
        if (hasValidMoves(board, i, grid)) {
          firstPlayer = i;
          break;
        }
        firstSkipped.push(i);
      }

      // 如果所有玩家都没有合法移动
      if (firstSkipped.length >= playerCount) {
        return {
          phase: 'finished',
          config: action.config,
          board,
          initialBoard: cloneBoard(board),
          currentPlayer: 0,
          moveHistory: [],
          winner: null,
          eliminated: new Set<number>(),
          message: '所有玩家均无合法移动，游戏无法开始',
          selectedCoord: null,
          validTargets: [],
        };
      }

      // 如果只有一方能够活动，直接获胜
      const soleFromStart = checkSoleSurvivor(board, action.config);
      if (soleFromStart !== null) {
        return {
          phase: 'finished',
          config: action.config,
          board,
          initialBoard: cloneBoard(board),
          currentPlayer: soleFromStart,
          moveHistory: [],
          winner: soleFromStart,
          eliminated: new Set<number>(),
          message: `🎉 ${action.config.players[soleFromStart].name} 获胜！（对手均无法行动）`,
          selectedCoord: null,
          validTargets: [],
        };
      }

      let skipMsg = '';
      if (firstSkipped.length > 0) {
        const names = firstSkipped.map((i) => action.config.players[i].name).join('、');
        skipMsg = `（${names} 无合法移动，已跳过）`;
      }

      return {
        phase: 'playing',
        config: action.config,
        board,
        initialBoard: cloneBoard(board),
        currentPlayer: firstPlayer,
        moveHistory: [],
        winner: null,
        eliminated: new Set<number>(),
        message: `游戏开始！轮到 ${action.config.players[firstPlayer].name}${skipMsg}`,
        selectedCoord: null,
        validTargets: [],
      };
    }

    case 'SELECT_CELL': {
      if (state.phase !== 'playing') return state;
      const { coord } = action;
      const key = coordToKey(coord);
      const cell = state.board.get(key);
      const player = state.currentPlayer;

      if (!cell) return state;

      // 如果已选中棋子，尝试移动到目标格子
      if (state.selectedCoord) {
        // 如果点击的是同一个棋子，取消选中
        if (coordsEqual(state.selectedCoord, coord)) {
          return { ...state, selectedCoord: null, validTargets: [] };
        }

        // 检查目标是否是有效目标之一
        const isValidTarget = state.validTargets.some((t) => coordsEqual(t, coord));
        if (isValidTarget) {
          // 执行移动
          const { newBoard, flipped } = executeMove(
            state.board,
            state.selectedCoord,
            coord,
            player,
          );

          const moveRecord: MoveRecord = {
            from: state.selectedCoord,
            to: coord,
            player,
            flipped,
          };

          const newHistory = [...state.moveHistory, moveRecord];
          const winner = checkWinner(newBoard);

          if (winner !== null) {
            return {
              ...state,
              board: newBoard,
              moveHistory: newHistory,
              winner,
              phase: 'finished',
              selectedCoord: null,
              validTargets: [],
              message: `🎉 ${state.config.players[winner].name} 获胜！`,
            };
          }

          // 检查是否只有一方能够活动（sole survivor）
          const soleSurvivor = checkSoleSurvivor(newBoard, state.config);
          if (soleSurvivor !== null) {
            return {
              ...state,
              board: newBoard,
              moveHistory: newHistory,
              winner: soleSurvivor,
              phase: 'finished',
              selectedCoord: null,
              validTargets: [],
              message: `🎉 ${state.config.players[soleSurvivor].name} 获胜！（对手均无法行动）`,
            };
          }

          // 自动推进到下一个玩家
          const { nextPlayer, skipped, allStuck } = findNextActivePlayer(
            newBoard,
            state.config,
            player,
            state.eliminated,
          );

          if (allStuck) {
            return {
              ...state,
              board: newBoard,
              moveHistory: newHistory,
              phase: 'finished',
              selectedCoord: null,
              validTargets: [],
              message: '所有玩家均无法移动，游戏结束',
            };
          }

          let skipMsg = '';
          if (skipped.length > 0) {
            const names = skipped.map((i) => state.config.players[i].name).join('、');
            skipMsg = `（${names} 无合法移动，已跳过）`;
          }

          return {
            ...state,
            board: newBoard,
            moveHistory: newHistory,
            currentPlayer: nextPlayer,
            selectedCoord: null,
            validTargets: [],
            message: `轮到 ${state.config.players[nextPlayer].name}${skipMsg}`,
          };
        }

        // 点击了己方其他棋子 → 切换选中
        if (cell.player === player) {
          const grid = generateHexGrid(state.config.radius);
          const moves = getValidMoves(state.board, player, grid);
          const targets = moves
            .filter((m) => coordsEqual(m.from, coord))
            .map((m) => m.to);
          return {
            ...state,
            selectedCoord: coord,
            validTargets: targets,
            message: `已选中棋子，请选择目标格子`,
          };
        }

        // 点击了无效目标 → 保持选中
        return state;
      }

      // 未选中任何棋子 → 尝试选中己方棋子
      if (cell.player === player) {
        const grid = generateHexGrid(state.config.radius);
        const moves = getValidMoves(state.board, player, grid);
        const targets = moves
          .filter((m) => coordsEqual(m.from, coord))
          .map((m) => m.to);
        if (targets.length === 0) {
          return { ...state, message: '该棋子没有可移动的目标格子' };
        }
        return {
          ...state,
          selectedCoord: coord,
          validTargets: targets,
          message: `已选中棋子，请选择目标格子`,
        };
      }

      // 点击了敌方棋子或空格
      if (cell.player !== null && cell.player !== player) {
        return { ...state, message: '只能移动自己的棋子' };
      }
      return { ...state, message: '请先选择一个己方棋子' };
    }

    case 'EXECUTE_MOVE': {
      if (state.phase !== 'playing') return state;
      const { from, to, player } = action;

      // 验证移动合法性
      const fromKey = coordToKey(from);
      const toKey = coordToKey(to);
      const fromCell = state.board.get(fromKey);
      const toCell = state.board.get(toKey);

      if (!fromCell || fromCell.player !== player) return state;
      if (!toCell || toCell.player !== null) return state;

      // 执行移动
      const { newBoard, flipped } = executeMove(state.board, from, to, player);

      const moveRecord: MoveRecord = { from, to, player, flipped };
      const newHistory = [...state.moveHistory, moveRecord];
      const winner = checkWinner(newBoard);

      if (winner !== null) {
        return {
          ...state,
          board: newBoard,
          moveHistory: newHistory,
          winner,
          phase: 'finished',
          selectedCoord: null,
          validTargets: [],
          message: `🎉 ${state.config.players[winner].name} 获胜！`,
        };
      }

      // 检查是否只有一方能够活动（sole survivor）
      const soleSurvivor2 = checkSoleSurvivor(newBoard, state.config);
      if (soleSurvivor2 !== null) {
        return {
          ...state,
          board: newBoard,
          moveHistory: newHistory,
          winner: soleSurvivor2,
          phase: 'finished',
          selectedCoord: null,
          validTargets: [],
          message: `🎉 ${state.config.players[soleSurvivor2].name} 获胜！（对手均无法行动）`,
        };
      }

      // 自动推进到下一个玩家
      const { nextPlayer, skipped, allStuck } = findNextActivePlayer(
        newBoard,
        state.config,
        player,
        state.eliminated,
      );

      if (allStuck) {
        return {
          ...state,
          board: newBoard,
          moveHistory: newHistory,
          phase: 'finished',
          selectedCoord: null,
          validTargets: [],
          message: '所有玩家均无法移动，游戏结束',
        };
      }

      let skipMsg = '';
      if (skipped.length > 0) {
        const names = skipped.map((i) => state.config.players[i].name).join('、');
        skipMsg = `（${names} 无合法移动，已跳过）`;
      }

      return {
        ...state,
        board: newBoard,
        moveHistory: newHistory,
        currentPlayer: nextPlayer,
        selectedCoord: null,
        validTargets: [],
        message: `轮到 ${state.config.players[nextPlayer].name}${skipMsg}`,
      };
    }

    case 'SKIP_TURN': {
      if (state.phase !== 'playing') return state;

      const { nextPlayer, skipped, allStuck } = findNextActivePlayer(
        state.board,
        state.config,
        state.currentPlayer,
        state.eliminated,
      );

      if (allStuck) {
        return {
          ...state,
          phase: 'finished',
          selectedCoord: null,
          validTargets: [],
          message: '所有玩家均无法移动，游戏结束',
        };
      }

      const skipNames = [state.currentPlayer, ...skipped]
        .filter((i) => i !== nextPlayer)
        .map((i) => state.config.players[i].name)
        .join('、');

      return {
        ...state,
        currentPlayer: nextPlayer,
        selectedCoord: null,
        validTargets: [],
        message: `${skipNames} 无合法移动，跳过。轮到 ${state.config.players[nextPlayer].name}`,
      };
    }

    case 'UNDO': {
      if (state.moveHistory.length === 0) {
        return { ...state, message: '没有可以撤销的步骤' };
      }
      // 从初始棋盘快照开始重建，而非随机生成
      const newBoard = cloneBoard(state.initialBoard);
      const newHistory = state.moveHistory.slice(0, -1);

      // 重放历史（除最后一步）
      let currentBoard = newBoard;
      for (const move of newHistory) {
        const { newBoard: b } = executeMove(currentBoard, move.from, move.to, move.player);
        currentBoard = b;
      }

      const prevPlayer = state.moveHistory.length > 0
        ? state.moveHistory[state.moveHistory.length - 1].player
        : 0;

      return {
        ...state,
        board: currentBoard,
        moveHistory: newHistory,
        currentPlayer: prevPlayer,
        winner: null,
        phase: 'playing',
        selectedCoord: null,
        validTargets: [],
        message: '已撤销上一步',
      };
    }

    case 'RESET': {
      const board = initializeBoard(state.config);
      const grid = generateHexGrid(state.config.radius);
      const playerCount = state.config.players.length;

      let firstPlayer = 0;
      for (let i = 0; i < playerCount; i++) {
        if (hasValidMoves(board, i, grid)) {
          firstPlayer = i;
          break;
        }
      }

      return {
        phase: 'playing',
        config: state.config,
        board,
        initialBoard: cloneBoard(board),
        currentPlayer: firstPlayer,
        moveHistory: [],
        winner: null,
        eliminated: new Set<number>(),
        message: `游戏已重置！轮到 ${state.config.players[firstPlayer].name}`,
        selectedCoord: null,
        validTargets: [],
      };
    }

    case 'SET_MESSAGE': {
      return { ...state, message: action.message };
    }

    case 'CLEAR_SELECTION': {
      return { ...state, selectedCoord: null, validTargets: [] };
    }

    default:
      return state;
  }
}

// ---- Hook ----

export function useGameState() {
  const [state, dispatch] = useReducer(gameReducer, null, () => {
    // 初始为配置阶段
    const cfg = createDefaultConfig();
    return {
      phase: 'config' as const,
      config: cfg,
      board: new Map(),
      initialBoard: new Map(),
      currentPlayer: 0,
      moveHistory: [],
      winner: null,
      eliminated: new Set<number>(),
      message: '请配置游戏参数，然后开始游戏',
      selectedCoord: null,
      validTargets: [],
    };
  });

  const gridRef = useRef(generateHexGrid(state.config.radius));

  // 更新 grid 缓存
  useEffect(() => {
    gridRef.current = generateHexGrid(state.config.radius);
  }, [state.config.radius]);

  const startGame = useCallback((config: GameConfig) => {
    dispatch({ type: 'START_GAME', config });
  }, []);

  const selectCell = useCallback((coord: CubeCoord) => {
    dispatch({ type: 'SELECT_CELL', coord });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const skipTurn = useCallback(() => {
    dispatch({ type: 'SKIP_TURN' });
  }, []);

  /** 直接执行一次移动（用于 AI、回放等场景） */
  const executeMoveAction = useCallback((from: CubeCoord, to: CubeCoord, player: number) => {
    dispatch({ type: 'EXECUTE_MOVE', from, to, player });
  }, []);

  /**
   * 为当前玩家执行 AI 移动（异步）
   * 返回 true 表示 AI 有合法移动并已执行，false 表示无合法移动
   */
  const triggerAIMove = useCallback((): boolean => {
    const player = state.currentPlayer;
    const playerConfig = state.config.players[player];

    if (!playerConfig.isAI || state.phase !== 'playing') return false;

    const move = getAIMove(state.board, player, gridRef.current, playerConfig.aiDifficulty);

    if (move) {
      // 直接使用 EXECUTE_MOVE，一步到位
      dispatch({ type: 'EXECUTE_MOVE', from: move.from, to: move.to, player });
      return true;
    }
    return false;
  }, [state.currentPlayer, state.config.players, state.phase, state.board]);

  return {
    state,
    startGame,
    selectCell,
    undo,
    reset,
    clearSelection,
    skipTurn,
    executeMoveAction,
    triggerAIMove,
    dispatch,
  };
}
