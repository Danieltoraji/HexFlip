// ============================================================
// HexFlip — 六边形翻转棋：类型定义
// ============================================================

/** 立方体坐标 (Cube Coordinates)，满足 q + r + s = 0 */
export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

/** 单个格子的状态 */
export interface CellState {
  /** 所属玩家索引，null 表示空格 */
  player: number | null;
}

/** 棋盘：key = "q,r,s" → CellState */
export type Board = Map<string, CellState>;

/** 单个玩家的配置 */
export interface PlayerConfig {
  name: string;
  color: string;
  isAI: boolean;
  aiDifficulty: 'easy' | 'medium' | 'hard';
}

/** 游戏全局配置 */
export interface GameConfig {
  /** 棋盘半径（2~7） */
  radius: number;
  /** 初始占空比（0.3~0.9） */
  fillRatio: number;
  /** 玩家数量（2/3/4） */
  playerCount: number;
  /** 各玩家详细配置 */
  players: PlayerConfig[];
  /** 出手顺序 */
  turnOrder: 'clockwise' | 'counterclockwise';
}

/** 单步移动记录，用于回放和历史 */
export interface MoveRecord {
  from: CubeCoord;
  to: CubeCoord;
  player: number;
  /** 本步被翻转的敌方棋子坐标列表 */
  flipped: CubeCoord[];
}

/** 游戏阶段 */
export type GamePhase = 'config' | 'playing' | 'finished';

/** 完整的游戏状态 */
export interface GameState {
  phase: GamePhase;
  config: GameConfig;
  board: Board;
  /** 初始棋盘快照（用于回放重建） */
  initialBoard: Board;
  currentPlayer: number;
  moveHistory: MoveRecord[];
  winner: number | null;
  eliminated: Set<number>;
  message: string;
  /** 当前选中的棋子坐标（UI状态） */
  selectedCoord: CubeCoord | null;
  /** 当前可移动的目标格子列表（UI状态） */
  validTargets: CubeCoord[];
}

/** 默认玩家颜色 */
export const DEFAULT_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];

/** 默认玩家名称 */
export const DEFAULT_NAMES = ['红方', '蓝方', '绿方', '橙方'];

/** AI 难度名称 */
export const AI_DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};
