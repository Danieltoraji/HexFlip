// ============================================================
// HexFlip — Canvas 事件处理 Hook
// ============================================================

import { useCallback, useEffect, useRef } from 'react';
import type { CubeCoord } from '../types/game';
import { pixelToHex } from '../logic/hexGrid';

interface UseCanvasEventsOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  hexSize: number;
  centerX: number;
  centerY: number;
  grid: CubeCoord[];
  onCellClick: (coord: CubeCoord) => void;
  onHover: (coord: CubeCoord | null) => void;
  enabled: boolean;
}

export function useCanvasEvents({
  canvasRef,
  hexSize,
  centerX,
  centerY,
  grid,
  onCellClick,
  onHover,
  enabled,
}: UseCanvasEventsOptions) {
  const hoverRef = useRef<CubeCoord | null>(null);

  const getHexCoord = useCallback(
    (clientX: number, clientY: number): CubeCoord | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      // 使用 CSS 像素偏移量，而非乘以 DPR
      // 因为绘制时已通过 ctx.setTransform(dpr, ...) 将坐标系映射到 CSS 像素空间
      const px = clientX - rect.left;
      const py = clientY - rect.top;

      return pixelToHex(px, py, hexSize, centerX, centerY);
    },
    [canvasRef, hexSize, centerX, centerY],
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;
      const coord = getHexCoord(e.clientX, e.clientY);
      if (coord) {
        // 验证坐标是否在棋盘内
        const inGrid = grid.some(
          (c) => c.q === coord.q && c.r === coord.r && c.s === coord.s,
        );
        if (inGrid) {
          onCellClick(coord);
        }
      }
    },
    [enabled, getHexCoord, grid, onCellClick],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;
      const coord = getHexCoord(e.clientX, e.clientY);
      if (coord) {
        const inGrid = grid.some(
          (c) => c.q === coord.q && c.r === coord.r && c.s === coord.s,
        );
        if (inGrid) {
          if (
            !hoverRef.current ||
            hoverRef.current.q !== coord.q ||
            hoverRef.current.r !== coord.r ||
            hoverRef.current.s !== coord.s
          ) {
            hoverRef.current = coord;
            onHover(coord);
          }
          return;
        }
      }
      if (hoverRef.current !== null) {
        hoverRef.current = null;
        onHover(null);
      }
    },
    [enabled, getHexCoord, grid, onHover],
  );

  const handleMouseLeave = useCallback(() => {
    hoverRef.current = null;
    onHover(null);
  }, [onHover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [canvasRef, handleClick, handleMouseMove, handleMouseLeave]);
}
