// ============================================================
// HexFlip — 六边形坐标工具
// 使用立方体坐标系 (Cube Coordinates)，满足 q + r + s = 0
// ============================================================

import type { CubeCoord } from '../types/game';

/**
 * 六个邻居方向向量（立方体坐标）
 * 顺序：右、右上、左上、左、左下、右下
 */
export const HEX_DIRECTIONS: CubeCoord[] = [
  { q: 1, r: -1, s: 0 },   // 右
  { q: 1, r: 0, s: -1 },   // 右上
  { q: 0, r: 1, s: -1 },   // 左上
  { q: -1, r: 1, s: 0 },   // 左
  { q: -1, r: 0, s: 1 },   // 左下
  { q: 0, r: -1, s: 1 },   // 右下
];

/**
 * 生成半径为 R 的正六边形棋盘上所有格子坐标
 * 条件：max(|q|, |r|, |s|) <= R 且 q + r + s = 0
 */
export function generateHexGrid(radius: number): CubeCoord[] {
  const cells: CubeCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      if (Math.abs(s) <= radius) {
        cells.push({ q, r, s });
      }
    }
  }
  return cells;
}

/**
 * 获取某个格子的六个邻居坐标（直接相加方向向量即可）
 */
export function getNeighbors(coord: CubeCoord): CubeCoord[] {
  return HEX_DIRECTIONS.map((d) => ({
    q: coord.q + d.q,
    r: coord.r + d.r,
    s: coord.s + d.s,
  }));
}

/**
 * 两个立方体坐标之间的六边形距离
 */
export function hexDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s),
  );
}

/**
 * 坐标 → 字符串 key（用于 Map 存储）
 */
export function coordToKey(c: CubeCoord): string {
  return `${c.q},${c.r},${c.s}`;
}

/**
 * 字符串 key → 坐标
 */
export function keyToCoord(key: string): CubeCoord {
  const [q, r, s] = key.split(',').map(Number);
  return { q, r, s };
}

/**
 * 将像素坐标转换为立方体坐标（flat-top 六边形）
 * 使用 fractional axial → cube rounding 算法
 *
 * @param px - 鼠标 x 坐标（相对画布）
 * @param py - 鼠标 y 坐标（相对画布）
 * @param hexSize - 六边形外接圆半径（像素）
 * @param centerX - 棋盘中心 x
 * @param centerY - 棋盘中心 y
 */
export function pixelToHex(
  px: number,
  py: number,
  hexSize: number,
  centerX: number,
  centerY: number,
): CubeCoord {
  // 相对于棋盘中心的坐标
  const x = px - centerX;
  const y = py - centerY;

  // flat-top: pixel → fractional axial (q, r)
  const fracQ = (2 / 3) * x / hexSize;
  const fracR = (-1 / 3) * x / hexSize + (Math.sqrt(3) / 3) * y / hexSize;

  return cubeRound(fracQ, fracR);
}

/**
 * 将立方体坐标转为像素坐标（flat-top 六边形中心点）
 */
export function hexToPixel(
  coord: CubeCoord,
  hexSize: number,
  centerX: number,
  centerY: number,
): { x: number; y: number } {
  const x = hexSize * (3 / 2) * coord.q;
  const y = hexSize * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return { x: centerX + x, y: centerY + y };
}

/**
 * 计算 flat-top 六边形的六个顶点（像素坐标）
 * @param centerX - 六边形中心 x
 * @param centerY - 六边形中心 y
 * @param size - 外接圆半径
 */
export function getHexVertices(
  centerX: number,
  centerY: number,
  size: number,
): { x: number; y: number }[] {
  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    // flat-top: 起始角度 0°
    const angle = (Math.PI / 180) * (60 * i);
    vertices.push({
      x: centerX + size * Math.cos(angle),
      y: centerY + size * Math.sin(angle),
    });
  }
  return vertices;
}

/**
 * 立方体坐标取整（fractional axial → cube rounding）
 * 算法：分别对 q, r, s 取整，修正误差最大的一项
 */
function cubeRound(fracQ: number, fracR: number): CubeCoord {
  let q = Math.round(fracQ);
  let r = Math.round(fracR);
  let s = Math.round(-fracQ - fracR);

  const dq = Math.abs(q - fracQ);
  const dr = Math.abs(r - fracR);
  const ds = Math.abs(s - (-fracQ - fracR));

  if (dq > dr && dq > ds) {
    q = -r - s;
  } else if (dr > ds) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return { q, r, s };
}

/**
 * 判断两个坐标是否相等
 */
export function coordsEqual(a: CubeCoord, b: CubeCoord): boolean {
  return a.q === b.q && a.r === b.r && a.s === b.s;
}

/**
 * 根据棋盘半径计算合适的六边形尺寸（使其填满画布）
 */
export function calculateHexSize(radius: number, canvasSize: number): number {
  // flat-top 布局宽度 ≈ hexSize * (1.5 * (2*radius) + 1)
  // 高度 ≈ hexSize * (sqrt(3) * (2*radius) + sqrt(3))
  const maxHexW = canvasSize / (1.5 * (2 * radius) + 1);
  const maxHexH = canvasSize / (Math.sqrt(3) * (2 * radius) + Math.sqrt(3));
  return Math.min(maxHexW, maxHexH) * 0.92; // 留一点边距
}
