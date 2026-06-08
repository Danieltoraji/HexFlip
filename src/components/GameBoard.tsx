// ============================================================
// HexFlip — 游戏棋盘组件（Canvas 渲染 + 交互）
// ============================================================

import React, { useRef, useEffect, useCallback } from 'react';
import type { CubeCoord, GameState } from '../types/game';
import {
  coordToKey,
  hexToPixel,
  getHexVertices,
  calculateHexSize,
  generateHexGrid,
} from '../logic/hexGrid';
import { useCanvasEvents } from '../hooks/useCanvasEvents';

interface GameBoardProps {
  state: GameState;
  onCellClick: (coord: CubeCoord) => void;
}

const CANVAS_SIZE = 600;

const GameBoard: React.FC<GameBoardProps> = ({ state, onCellClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoveredCoordRef = useRef<CubeCoord | null>(null);
  const animFrameRef = useRef<number>(0);
  const stateRef = useRef<GameState>(state);

  // 保持 stateRef 与最新 state 同步
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const hexSize = calculateHexSize(state.config.radius, CANVAS_SIZE);
  const centerX = CANVAS_SIZE / 2;
  const centerY = CANVAS_SIZE / 2;
  const grid = generateHexGrid(state.config.radius);

  // 缓存布局参数到 ref
  const layoutRef = useRef({ hexSize, centerX, centerY, grid });
  useEffect(() => {
    layoutRef.current = { hexSize, centerX, centerY, grid };
  }, [hexSize, centerX, centerY, grid]);

  // 鼠标悬浮回调
  const onHover = useCallback((coord: CubeCoord | null) => {
    hoveredCoordRef.current = coord;
  }, []);

  // Canvas 事件绑定
  useCanvasEvents({
    canvasRef,
    hexSize,
    centerX,
    centerY,
    grid,
    onCellClick,
    onHover,
    enabled: state.phase === 'playing',
  });

  // ---- 绘制函数 ----

  const drawHexagon = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      size: number,
      fillColor: string,
      strokeColor: string,
      lineWidth: number = 2,
    ) => {
      const vertices = getHexVertices(cx, cy, size);
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
      }
      ctx.closePath();

      // 填充
      ctx.fillStyle = fillColor;
      ctx.fill();

      // 描边
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.stroke();

      return vertices;
    },
    [],
  );

  const drawPiece = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      radius: number,
      color: string,
      isSelected: boolean,
      pulsePhase: number,
    ) => {
      // 主体渐变（玻璃珠效果）
      const gradient = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        radius * 0.1,
        cx,
        cy,
        radius,
      );
      gradient.addColorStop(0, lightenColor(color, 60));
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, darkenColor(color, 30));

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 边框
      ctx.strokeStyle = darkenColor(color, 40);
      ctx.lineWidth = 2;
      ctx.stroke();

      // 高光小圆点
      ctx.beginPath();
      ctx.arc(
        cx - radius * 0.25,
        cy - radius * 0.25,
        radius * 0.18,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();

      // 选中脉冲光圈
      if (isSelected) {
        const pulse = 0.7 + 0.3 * Math.sin(pulsePhase);
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    },
    [],
  );

  // ---- 主渲染循环（稳定引用，通过 ref 读取最新状态） ----

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;
    const { hexSize: hs, centerX: cx, centerY: cy, grid: g } = layoutRef.current;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== CANVAS_SIZE * dpr || canvas.height !== CANVAS_SIZE * dpr) {
      canvas.width = CANVAS_SIZE * dpr;
      canvas.height = CANVAS_SIZE * dpr;
      canvas.style.width = `${CANVAS_SIZE}px`;
      canvas.style.height = `${CANVAS_SIZE}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 清屏
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 背景渐变
    const bgGradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    bgGradient.addColorStop(0, '#e8f4fd');
    bgGradient.addColorStop(0.5, '#f0e6ff');
    bgGradient.addColorStop(1, '#e8f4fd');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 装饰云朵
    drawClouds(ctx);

    // 脉冲相位（用于选中棋子动画）
    const pulsePhase = Date.now() / 250;

    // 当前玩家
    const currentPlayer = s.config.players[s.currentPlayer];

    // 绘制格子
    for (const cell of g) {
      const { x, y } = hexToPixel(cell, hs, cx, cy);
      const key = coordToKey(cell);
      const cellState = s.board.get(key);

      const isSelected =
        s.selectedCoord !== null &&
        s.selectedCoord.q === cell.q &&
        s.selectedCoord.r === cell.r &&
        s.selectedCoord.s === cell.s;

      const isTarget = s.validTargets.some(
        (t) => t.q === cell.q && t.r === cell.r && t.s === cell.s,
      );

      const hv = hoveredCoordRef.current;
      const isHovered =
        hv !== null &&
        hv.q === cell.q && hv.r === cell.r && hv.s === cell.s;

      // 填充色
      let fillColor = '#faf5ef';
      if (isTarget) {
        fillColor = 'rgba(46, 204, 113, 0.35)';
      } else if (isHovered && s.phase === 'playing') {
        fillColor = 'rgba(255, 255, 255, 0.6)';
      }

      // 描边色
      let strokeColor = '#c4b5a5';
      if (isHovered && s.phase === 'playing') {
        strokeColor = currentPlayer?.color || '#3498DB';
      }

      drawHexagon(ctx, x, y, hs * 0.92, fillColor, strokeColor, 2);

      // 绘制棋子
      if (cellState?.player !== null) {
        const playerConfig = s.config.players[cellState!.player];
        drawPiece(
          ctx,
          x,
          y,
          hs * 0.55,
          playerConfig.color,
          isSelected,
          pulsePhase,
        );
      }
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [drawHexagon, drawPiece]);

  // 启动渲染循环（仅一次）
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [renderFrame]);

  return (
    <div
      ref={containerRef}
      className="game-board-container"
      style={{
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: state.phase === 'playing'
          ? `0 0 30px ${state.config.players[state.currentPlayer]?.color || '#3498DB'}40`
          : '0 8px 32px rgba(0,0,0,0.12)',
        transition: 'box-shadow 0.5s ease',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          cursor: state.phase === 'playing' ? 'pointer' : 'default',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};

// ---- 辅助函数 ----

/** 颜色变亮 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + percent);
  const b = Math.min(255, (num & 0x0000ff) + percent);
  return `rgb(${r},${g},${b})`;
}

/** 颜色变暗 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - percent);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - percent);
  const b = Math.max(0, (num & 0x0000ff) - percent);
  return `rgb(${r},${g},${b})`;
}

/** 绘制装饰云朵 */
function drawClouds(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  const clouds = [
    { x: 80, y: 60, s: 30 },
    { x: 450, y: 45, s: 22 },
    { x: 530, y: 110, s: 16 },
    { x: 140, y: 500, s: 24 },
    { x: 490, y: 490, s: 18 },
  ];
  for (const c of clouds) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.s, 0, Math.PI * 2);
    ctx.arc(c.x + c.s * 0.8, c.y - c.s * 0.3, c.s * 0.7, 0, Math.PI * 2);
    ctx.arc(c.x + c.s * 1.5, c.y, c.s * 0.8, 0, Math.PI * 2);
    ctx.arc(c.x + c.s * 0.6, c.y + c.s * 0.3, c.s * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default GameBoard;
