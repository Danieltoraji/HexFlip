// ============================================================
// HexFlip — 棋局回放模态框
// 步进控制、进度条、逐帧显示历史棋盘状态
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GameConfig, MoveRecord, Board, CubeCoord } from '../types/game';
import {
  coordToKey,
  hexToPixel,
  getHexVertices,
  calculateHexSize,
  generateHexGrid,
} from '../logic/hexGrid';
import { executeMove, cloneBoard } from '../logic/gameEngine';

interface ReplayModalProps {
  config: GameConfig;
  moves: MoveRecord[];
  initialBoard: Board;
  onClose: () => void;
}

const CANVAS_SIZE = 500;

const ReplayModal: React.FC<ReplayModalProps> = ({ config, moves, initialBoard, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playTimerRef = useRef<number | null>(null);

  const hexSize = calculateHexSize(config.radius, CANVAS_SIZE);
  const centerX = CANVAS_SIZE / 2;
  const centerY = CANVAS_SIZE / 2;
  const grid = generateHexGrid(config.radius);

  // 从初始棋盘快照重建指定步数后的棋盘
  const buildBoardAtStep = useCallback(
    (step: number): Board => {
      let board = cloneBoard(initialBoard);
      for (let i = 0; i < step && i < moves.length; i++) {
        const move = moves[i];
        const { newBoard } = executeMove(board, move.from, move.to, move.player);
        board = newBoard;
      }
      return board;
    },
    [initialBoard, moves],
  );

  // 绘制棋盘
  const drawBoard = useCallback(
    (board: Board, step: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = CANVAS_SIZE * dpr;
      canvas.height = CANVAS_SIZE * dpr;
      canvas.style.width = `${CANVAS_SIZE}px`;
      canvas.style.height = `${CANVAS_SIZE}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 背景
      const bgGradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      bgGradient.addColorStop(0, '#e8f4fd');
      bgGradient.addColorStop(1, '#f0e6ff');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // 当前步骤的移动信息
      const currentMove = step > 0 && step <= moves.length ? moves[step - 1] : null;

      // 绘制格子
      for (const cell of grid) {
        const { x, y } = hexToPixel(cell, hexSize, centerX, centerY);
        const key = coordToKey(cell);
        const cellState = board.get(key);

        // 高亮最近移动
        let fillColor = '#faf5ef';
        let strokeColor = '#c4b5a5';

        if (currentMove) {
          const isFrom =
            currentMove.from.q === cell.q &&
            currentMove.from.r === cell.r &&
            currentMove.from.s === cell.s;
          const isTo =
            currentMove.to.q === cell.q &&
            currentMove.to.r === cell.r &&
            currentMove.to.s === cell.s;
          const isFlipped = currentMove.flipped.some(
            (f) => f.q === cell.q && f.r === cell.r && f.s === cell.s,
          );

          if (isFrom) {
            fillColor = 'rgba(255, 200, 50, 0.4)';
            strokeColor = '#e67e22';
          } else if (isTo) {
            fillColor = 'rgba(46, 204, 113, 0.4)';
            strokeColor = '#27ae60';
          } else if (isFlipped) {
            fillColor = 'rgba(231, 76, 60, 0.3)';
            strokeColor = '#c0392b';
          }
        }

        // 绘制六边形
        const vertices = getHexVertices(x, y, hexSize * 0.92);
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // 绘制棋子
        if (cellState?.player !== null) {
          const playerConfig = config.players[cellState!.player];
          const pieceRadius = hexSize * 0.5;

          const gradient = ctx.createRadialGradient(
            x - pieceRadius * 0.3,
            y - pieceRadius * 0.3,
            pieceRadius * 0.1,
            x,
            y,
            pieceRadius,
          );
          gradient.addColorStop(0, lighten(playerConfig.color, 50));
          gradient.addColorStop(0.5, playerConfig.color);
          gradient.addColorStop(1, darken(playerConfig.color, 30));

          ctx.beginPath();
          ctx.arc(x, y, pieceRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.strokeStyle = darken(playerConfig.color, 40);
          ctx.lineWidth = 2;
          ctx.stroke();

          // 高光
          ctx.beginPath();
          ctx.arc(x - pieceRadius * 0.25, y - pieceRadius * 0.25, pieceRadius * 0.18, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fill();
        }
      }

      // 绘制步骤标注
      if (currentMove) {
        const fromPos = hexToPixel(currentMove.from, hexSize, centerX, centerY);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px "Comic Neue", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('起', fromPos.x, fromPos.y - hexSize * 0.7);

        const toPos = hexToPixel(currentMove.to, hexSize, centerX, centerY);
        ctx.fillText('终', toPos.x, toPos.y - hexSize * 0.7);
      }
    },
    [config, grid, hexSize, centerX, centerY, moves],
  );

  // 当步骤变化时重绘
  useEffect(() => {
    const board = buildBoardAtStep(currentStep);
    drawBoard(board, currentStep);
  }, [currentStep, buildBoardAtStep, drawBoard]);

  // 自动播放
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= moves.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isPlaying, moves.length]);

  const handleStepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    setCurrentStep(Number(e.target.value));
  };

  const progressPercent = moves.length > 0 ? (currentStep / moves.length) * 100 : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content replay-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">📽️ 棋局回放</h2>

        <div className="replay-canvas-container">
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* 进度条 */}
        <div className="replay-progress">
          <input
            type="range"
            min={0}
            max={moves.length}
            value={currentStep}
            onChange={handleStepChange}
            className="slider replay-slider"
          />
          <span className="replay-step-text">
            {currentStep} / {moves.length} 步
          </span>
        </div>

        {/* 控制按钮 */}
        <div className="replay-controls">
          <button
            className="btn-control"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStep(0);
            }}
            disabled={currentStep === 0}
          >
            ⏮ 最初
          </button>
          <button
            className="btn-control"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStep((p) => Math.max(0, p - 1));
            }}
            disabled={currentStep === 0}
          >
            ⏪ 上一步
          </button>
          <button
            className="btn-control btn-play"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </button>
          <button
            className="btn-control"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStep((p) => Math.min(moves.length, p + 1));
            }}
            disabled={currentStep >= moves.length}
          >
            ⏩ 下一步
          </button>
          <button
            className="btn-control"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStep(moves.length);
            }}
            disabled={currentStep >= moves.length}
          >
            ⏭ 最后
          </button>
        </div>

        {/* 移动列表 */}
        <div className="replay-move-list">
          <h3>移动记录</h3>
          <div className="move-list-scroll">
            {moves.map((move, i) => (
              <div
                key={i}
                className={`move-item ${i === currentStep - 1 ? 'current' : ''}`}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep(i + 1);
                }}
              >
                <span className="move-num">#{i + 1}</span>
                <span
                  className="move-player-dot"
                  style={{ background: config.players[move.player].color }}
                />
                <span className="move-desc">
                  ({move.from.q},{move.from.r}) → ({move.to.q},{move.to.r})
                </span>
                {move.flipped.length > 0 && (
                  <span className="move-flip">+{move.flipped.length}</span>
                )}
              </div>
            ))}
            {moves.length === 0 && (
              <div className="move-empty">暂无移动记录</div>
            )}
          </div>
        </div>

        <button className="btn-close-modal" onClick={onClose}>
          ✕ 关闭
        </button>
      </div>
    </div>
  );
};

// 辅助
function lighten(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (n >> 16) + a);
  const g = Math.min(255, ((n >> 8) & 0xff) + a);
  const b = Math.min(255, (n & 0xff) + a);
  return `rgb(${r},${g},${b})`;
}
function darken(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - a);
  const g = Math.max(0, ((n >> 8) & 0xff) - a);
  const b = Math.max(0, (n & 0xff) - a);
  return `rgb(${r},${g},${b})`;
}

export default ReplayModal;
