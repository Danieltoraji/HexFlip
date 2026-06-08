// ============================================================
// HexFlip — 棋局导入导出工具
// ============================================================

import type { Board, GameConfig, MoveRecord, CubeCoord } from '../types/game';
import { coordToKey, keyToCoord } from '../logic/hexGrid';

/** 序列化的格子数据 */
interface SerializedCell {
  q: number;
  r: number;
  s: number;
  player: number | null;
}

export interface GameExportData {
  version: string;
  exportDate: string;
  config: GameConfig;
  /** 初始棋盘布局（序列化） */
  initialBoard: SerializedCell[];
  moves: MoveRecord[];
  winner: number | null;
}

/** 将 Board 序列化为可 JSON 存储的数组 */
export function serializeBoard(board: Board): SerializedCell[] {
  const cells: SerializedCell[] = [];
  for (const [key, cell] of board.entries()) {
    const coord = keyToCoord(key);
    cells.push({ q: coord.q, r: coord.r, s: coord.s, player: cell.player });
  }
  return cells;
}

/** 从序列化数组反序列化为 Board */
export function deserializeBoard(cells: SerializedCell[]): Board {
  const board: Board = new Map();
  for (const c of cells) {
    board.set(coordToKey({ q: c.q, r: c.r, s: c.s }), { player: c.player });
  }
  return board;
}

/**
 * 导出棋局为 JSON 文件并触发下载
 */
export function exportGame(
  config: GameConfig,
  initialBoard: Board,
  moves: MoveRecord[],
  winner: number | null,
): void {
  const data: GameExportData = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    config,
    initialBoard: serializeBoard(initialBoard),
    moves,
    winner,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `hexflip_${dateStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入棋局
 * @returns 解析后的数据，或 null（失败）
 */
export function importGame(jsonStr: string): GameExportData | null {
  try {
    const data = JSON.parse(jsonStr) as GameExportData;
    if (!data.version || !data.config || !data.moves) {
      throw new Error('无效的存档文件格式');
    }
    return data;
  } catch (e) {
    console.error('导入失败:', e);
    return null;
  }
}

/**
 * 打开文件选择对话框并读取 JSON 文件
 */
export function openImportDialog(): Promise<GameExportData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const data = importGame(text);
        resolve(data);
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };

    input.click();
  });
}
