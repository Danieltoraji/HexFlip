// ============================================================
// HexFlip — 游戏引擎：移动合法性、转化逻辑、获胜检测
// ============================================================

import type { Board, CellState, CubeCoord, GameConfig, GameState, MoveRecord } from '../types/game';
import { coordToKey, getNeighbors, hexDistance, generateHexGrid } from './hexGrid';

/**
 * 初始化棋盘：随机放置棋子
 * 1. 先生成所有格子坐标
 * 2. 按 fillRatio 随机选择占用的格子
 * 3. 按各玩家比例分配棋子
 */
export function initializeBoard(config: GameConfig): Board {
  const board: Board = new Map();
  const allCells = generateHexGrid(config.radius);

  // 所有格子初始为空
  for (const cell of allCells) {
    board.set(coordToKey(cell), { player: null });
  }

  // 计算需要放置棋子的数量
  const totalCells = allCells.length;
  const filledCount = Math.floor(totalCells * config.fillRatio);
  const playerCount = config.players.length;

  // Fisher-Yates 打乱格子顺序
  const shuffled = [...allCells];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 取前 filledCount 个格子
  const filledCells = shuffled.slice(0, filledCount);

  // 计算每个玩家应得的棋子数量
  const counts: number[] = [];
  let totalRatio = 0;
  for (let p = 0; p < playerCount; p++) {
    const ratio = p < playerCount - 1
      ? (1 / playerCount) // 默认均分
      : 1 - totalRatio;
    totalRatio += ratio;
    counts.push(Math.floor(filledCount * ratio));
  }

  // 调整最后一个玩家的数量以匹配总数
  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum < filledCount) {
    counts[playerCount - 1] += filledCount - sum;
  }

  // 按顺序分配棋子给各玩家
  let idx = 0;
  for (let p = 0; p < playerCount; p++) {
    for (let c = 0; c < counts[p]; c++) {
      if (idx < filledCells.length) {
        board.set(coordToKey(filledCells[idx]), { player: p });
        idx++;
      }
    }
  }

  return board;
}

/**
 * 获取某个玩家的所有合法移动
 * 合法移动 = 选择己方棋子 → 移动到相邻空格
 * 返回 [{from, to}, ...]
 */
export function getValidMoves(
  board: Board,
  player: number,
  grid: CubeCoord[],
): { from: CubeCoord; to: CubeCoord }[] {
  const moves: { from: CubeCoord; to: CubeCoord }[] = [];

  for (const cell of grid) {
    const state = board.get(coordToKey(cell));
    if (!state || state.player !== player) continue;

    // 该格子上有己方棋子，检查六个邻居
    const neighbors = getNeighbors(cell);
    for (const neighbor of neighbors) {
      const nState = board.get(coordToKey(neighbor));
      if (nState && nState.player === null) {
        // 邻居是空格，合法移动
        moves.push({ from: cell, to: neighbor });
      }
    }
  }

  return moves;
}

/**
 * 检查某个玩家是否有合法移动
 */
export function hasValidMoves(
  board: Board,
  player: number,
  grid: CubeCoord[],
): boolean {
  for (const cell of grid) {
    const state = board.get(coordToKey(cell));
    if (!state || state.player !== player) continue;

    const neighbors = getNeighbors(cell);
    for (const neighbor of neighbors) {
      const nState = board.get(coordToKey(neighbor));
      if (nState && nState.player === null) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 执行一步移动，返回新的游戏状态（不修改原状态）
 * 注意：这里只返回局部的棋盘变化，调用方需要整合到完整状态
 */
export function executeMove(
  board: Board,
  from: CubeCoord,
  to: CubeCoord,
  player: number,
): { newBoard: Board; flipped: CubeCoord[] } {
  // 深拷贝棋盘
  const newBoard: Board = new Map();
  for (const [key, cell] of board.entries()) {
    newBoard.set(key, { ...cell });
  }

  // 移动棋子：原格子变空
  newBoard.set(coordToKey(from), { player: null });
  // 目标格子放上己方棋子
  newBoard.set(coordToKey(to), { player });

  // 转化规则：检查目标格子周围六个格子中的敌方棋子
  const flipped: CubeCoord[] = [];
  const neighbors = getNeighbors(to);
  for (const neighbor of neighbors) {
    const nState = newBoard.get(coordToKey(neighbor));
    if (nState && nState.player !== null && nState.player !== player) {
      // 是敌方棋子，翻转为己方
      newBoard.set(coordToKey(neighbor), { player });
      flipped.push(neighbor);
    }
  }

  return { newBoard, flipped };
}

/**
 * 检查获胜条件：棋盘上所有非空格子是否都属于同一玩家
 * 返回获胜玩家索引，或 null（无人获胜）
 */
export function checkWinner(board: Board): number | null {
  let winner: number | null = null;

  for (const [, cell] of board.entries()) {
    if (cell.player === null) continue;
    if (winner === null) {
      winner = cell.player;
    } else if (cell.player !== winner) {
      return null; // 存在两个不同玩家的棋子
    }
  }

  return winner;
}

/**
 * 统计各玩家的棋子数量
 */
export function countPieces(board: Board, playerCount: number): number[] {
  const counts = new Array(playerCount).fill(0);
  for (const [, cell] of board.entries()) {
    if (cell.player !== null) {
      counts[cell.player]++;
    }
  }
  return counts;
}

/**
 * 获取棋盘上所有属于某玩家的棋子坐标
 */
export function getPlayerPieces(board: Board, player: number): CubeCoord[] {
  const pieces: CubeCoord[] = [];
  for (const [key, cell] of board.entries()) {
    if (cell.player === player) {
      const [q, r, s] = key.split(',').map(Number);
      pieces.push({ q, r, s });
    }
  }
  return pieces;
}

/** 深拷贝一个棋盘 */
export function cloneBoard(board: Board): Board {
  const copy: Board = new Map();
  for (const [key, cell] of board.entries()) {
    copy.set(key, { player: cell.player });
  }
  return copy;
}

/**
 * 检查某玩家是否已被淘汰（棋子数为 0）
 */
export function isEliminated(board: Board, player: number): boolean {
  for (const [, cell] of board.entries()) {
    if (cell.player === player) return false;
  }
  return true;
}
