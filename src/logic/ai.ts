// ============================================================
// HexFlip — AI 决策模块（性能优化版）
// 三个难度级别：简单（随机）、中等（贪心）、困难（优化Minimax）
// ============================================================

import type { Board, CubeCoord } from '../types/game';
import { coordToKey, getNeighbors, hexDistance } from './hexGrid';
import { getValidMoves, executeMove, checkWinner, hasValidMoves } from './gameEngine';

type Difficulty = 'easy' | 'medium' | 'hard';

// ---- 性能配置 ----
const TIME_LIMIT = 1000;       // 总时间限制 ms
const TIMER_CHECK_INTERVAL = 8; // 每 N 个节点检查一次时间
let nodeCount = 0;              // 全局节点计数器（用于低频时间检查）

// ---- 公开入口 ----

export function getAIMove(
  board: Board,
  player: number,
  grid: CubeCoord[],
  difficulty: Difficulty,
): { from: CubeCoord; to: CubeCoord } | null {
  const moves = getValidMoves(board, player, grid);
  if (moves.length === 0) return null;

  switch (difficulty) {
    case 'easy':
      return aiEasy(moves);
    case 'medium':
      return aiMedium(board, player, moves);
    case 'hard':
      return aiHard(board, player, grid, moves);
    default:
      return aiEasy(moves);
  }
}

// ---- 简单 AI ----

function aiEasy(moves: { from: CubeCoord; to: CubeCoord }[]): { from: CubeCoord; to: CubeCoord } {
  return moves[Math.floor(Math.random() * moves.length)];
}

// ---- 中等 AI（贪心） ----

function aiMedium(
  board: Board,
  player: number,
  moves: { from: CubeCoord; to: CubeCoord }[],
): { from: CubeCoord; to: CubeCoord } {
  let bestMove = moves[0];
  let bestFlip = -1;
  for (const move of moves) {
    const { flipped } = executeMove(board, move.from, move.to, player);
    if (flipped.length > bestFlip) {
      bestFlip = flipped.length;
      bestMove = move;
    }
  }
  return bestMove;
}

// ============================================================
// 困难 AI（优化 Minimax + Alpha-Beta + 迭代加深）
// 性能优化要点：
//   - 深度上限 5（自适应）
//   - 评估函数单次遍历、不含机动性
//   - 低频时间检查（每 8 节点一次）
//   - 移动排序用轻量启发式
//   - 大幅领先时提前截断
// ============================================================

function inferPlayerCount(board: Board): number {
  let maxPlayer = -1;
  for (const [, cell] of board.entries()) {
    if (cell.player !== null && cell.player > maxPlayer) maxPlayer = cell.player;
  }
  return Math.max(2, maxPlayer + 1);
}

function aiHard(
  board: Board,
  player: number,
  grid: CubeCoord[],
  moves: { from: CubeCoord; to: CubeCoord }[],
): { from: CubeCoord; to: CubeCoord } {
  const playerCount = inferPlayerCount(board);
  const startTime = Date.now();
  nodeCount = 0;

  // 自适应深度：移动数少则更深
  const baseDepth = moves.length > 35 ? 2 : moves.length > 15 ? 3 : 4;
  const maxDepth = Math.min(5, baseDepth + 1);

  // 轻量排序：按翻转数 + 中心靠近度排序
  const scoredMoves = moves.map((m) => {
    const { flipped } = executeMove(board, m.from, m.to, player);
    // 中心靠近加分（距离棋盘中心越近越好）
    const centerDist = hexDistance(m.to, { q: 0, r: 0, s: 0 });
    return { ...m, score: flipped.length * 10 + (6 - centerDist) };
  });
  scoredMoves.sort((a, b) => b.score - a.score);

  let bestMove = scoredMoves[0];
  let bestScore = -Infinity;

  // 迭代加深
  for (let depth = 2; depth <= maxDepth; depth++) {
    if (Date.now() - startTime > TIME_LIMIT * 0.5) break;

    let currentBest = scoredMoves[0];
    let currentBestScore = -Infinity;
    let timedOut = false;

    for (const move of scoredMoves) {
      if (nodeCount % TIMER_CHECK_INTERVAL === 0 && Date.now() - startTime > TIME_LIMIT) {
        timedOut = true;
        break;
      }

      const { newBoard, flipped } = executeMove(board, move.from, move.to, player);
      if (checkWinner(newBoard) === player) return move;

      // 早停：如果某步翻转 5+ 棋子且不会被翻回来，直接选它
      if (flipped.length >= 5) {
        const nextPlayer = (player + 1) % playerCount;
        const enemyMoves = getValidMoves(newBoard, nextPlayer, grid);
        const canRetaliate = enemyMoves.some((em) => {
          const r = executeMove(newBoard, em.from, em.to, nextPlayer);
          return r.flipped.length >= 3;
        });
        if (!canRetaliate) return move;
      }

      if (checkSoleFast(newBoard, playerCount, player, grid)) return move;

      const nextPlayer = (player + 1) % playerCount;
      const score = minimax(
        newBoard, player, playerCount, grid, depth - 1, false,
        -Infinity, Infinity, nextPlayer, startTime,
      );

      if (score > currentBestScore) {
        currentBestScore = score;
        currentBest = move;
      }
    }

    if (!timedOut) {
      bestScore = currentBestScore;
      bestMove = currentBest;
    }
  }

  return bestMove;
}

// ---- Minimax（优化版） ----

function minimax(
  board: Board, aiPlayer: number, playerCount: number, grid: CubeCoord[],
  depth: number, isMax: boolean, alpha: number, beta: number,
  currentPlayer: number, startTime: number,
): number {
  nodeCount++;

  // 低频时间检查
  if (nodeCount % TIMER_CHECK_INTERVAL === 0 && Date.now() - startTime > TIME_LIMIT) {
    return evaluateFast(board, aiPlayer, playerCount, grid);
  }

  // 叶子节点 → 静态评估
  if (depth <= 0) {
    return evaluateFast(board, aiPlayer, playerCount, grid);
  }

  // 终止检查
  const winner = checkWinner(board);
  if (winner === aiPlayer) return 10000 + depth * 100;
  if (winner !== null) return -10000 - depth * 100;

  const moves = getValidMoves(board, currentPlayer, grid);

  // 无合法移动 → 跳过
  if (moves.length === 0) {
    const next = (currentPlayer + 1) % playerCount;
    if (next === aiPlayer) return 10000 + depth * 100;
    return minimax(board, aiPlayer, playerCount, grid, depth, true, alpha, beta, next, startTime);
  }

  // 轻量排序：不调用 executeMove，用终点的中心距离近似
  const ordered = quickSort(moves);

  if (isMax) {
    let maxEval = -Infinity;
    for (const move of ordered) {
      const { newBoard } = executeMove(board, move.from, move.to, currentPlayer);
      if (checkWinner(newBoard) === aiPlayer) return 10000 + depth * 100;
      const next = (currentPlayer + 1) % playerCount;
      const val = minimax(newBoard, aiPlayer, playerCount, grid, depth - 1,
        next === aiPlayer, alpha, beta, next, startTime);
      maxEval = Math.max(maxEval, val);
      if (maxEval > 8000) return maxEval; // 已接近必胜，提前返回
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of ordered) {
      const { newBoard } = executeMove(board, move.from, move.to, currentPlayer);
      const w = checkWinner(newBoard);
      if (w !== null && w !== aiPlayer) return -10000 - depth * 100;
      const next = (currentPlayer + 1) % playerCount;
      const val = minimax(newBoard, aiPlayer, playerCount, grid, depth - 1,
        next === aiPlayer, alpha, beta, next, startTime);
      minEval = Math.min(minEval, val);
      if (minEval < -8000) return minEval; // 接近必败，提前返回
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// ============================================================
// 快速评估函数（单次遍历，不含机动性）
// ============================================================

function evaluateFast(board: Board, aiPlayer: number, playerCount: number, grid: CubeCoord[]): number {
  let aiPieces = 0;
  let enemyPieces = 0;
  let flipPot = 0;       // AI 棋子邻接的敌人数
  let centerScore = 0;
  const center = { q: 0, r: 0, s: 0 };

  // 单次遍历收集所有数据
  for (const [key, cell] of board.entries()) {
    if (cell.player === null) continue;

    const [q, r, s] = key.split(',').map(Number);
    const coord: CubeCoord = { q, r, s };
    const d = hexDistance(coord, center);

    if (cell.player === aiPlayer) {
      aiPieces++;
      centerScore += (6 - d);

      // 计算翻转潜力：检查邻居中的敌人
      for (const n of getNeighbors(coord)) {
        const nc = board.get(coordToKey(n));
        if (nc && nc.player !== null && nc.player !== aiPlayer) {
          flipPot++;
        }
      }
    } else {
      enemyPieces++;
      centerScore -= (6 - d) * 0.8;
    }
  }

  // 综合评分
  let score = aiPieces * 10 - enemyPieces * 12;
  score += flipPot * 2;
  score += centerScore;

  // 棋子为 0 → 淘汰
  if (aiPieces === 0) return -20000;
  if (enemyPieces === 0) return 20000;

  // 快速 sole survivor 检测（只在棋子差距大时检测）
  if (aiPieces > enemyPieces * 2) {
    if (checkSoleFast(board, playerCount, aiPlayer, grid)) return 10000;
  }

  return score;
}

// ---- 辅助 ----

/** 快速 sole survivor 检测 */
function checkSoleFast(board: Board, playerCount: number, aiPlayer: number, grid: CubeCoord[]): boolean {
  if (!hasValidMoves(board, aiPlayer, grid)) return false;
  for (let p = 0; p < playerCount; p++) {
    if (p !== aiPlayer && hasValidMoves(board, p, grid)) return false;
  }
  return true;
}

/**
 * 轻量移动排序：按目标格到棋盘中心的距离排序
 * 中心格子通常有更多邻居，控制中心有利于翻转
 */
function quickSort(moves: { from: CubeCoord; to: CubeCoord }[]): { from: CubeCoord; to: CubeCoord }[] {
  const center = { q: 0, r: 0, s: 0 };
  const arr = moves.map((m) => ({
    ...m,
    _d: hexDistance(m.to, center),
  }));
  arr.sort((a, b) => (a as any)._d - (b as any)._d); // 离中心近的优先
  return arr.map(({ _d, ...m }: any) => m);
}
