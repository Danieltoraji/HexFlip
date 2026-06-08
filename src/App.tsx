// ============================================================
// HexFlip — 主应用组件
// 协调配置面板、游戏棋盘、控制栏、回放模态框
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { GameConfig } from './types/game';
import { generateHexGrid } from './logic/hexGrid';
import { getAIMove } from './logic/ai';
import { exportGame, openImportDialog } from './utils/exportImport';
import { captureScreenshot } from './utils/screenshot';
import { useGameState } from './hooks/useGameState';
import ConfigPanel from './components/ConfigPanel';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import ReplayModal from './components/ReplayModal';
import './App.css';

const App: React.FC = () => {
  const {
    state,
    startGame,
    selectCell,
    undo,
    reset,
    clearSelection,
    skipTurn,
    dispatch,
  } = useGameState();

  const [showReplay, setShowReplay] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const aiTimerRef = useRef<number | null>(null);

  // 保存最新 state 到 ref，避免闭包过期问题
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // === 当回合切换到 AI 玩家时，自动触发 AI 移动 ===
  useEffect(() => {
    const s = stateRef.current;
    if (s.phase !== 'playing') return;

    const player = s.currentPlayer;
    const playerConfig = s.config.players[player];
    if (!playerConfig.isAI) return;

    // 延迟执行，给玩家视觉反馈
    aiTimerRef.current = window.setTimeout(() => {
      const latest = stateRef.current;
      // 安全检查：确保仍然轮到该AI玩家
      if (latest.phase !== 'playing' || latest.currentPlayer !== player) return;

      const grid = generateHexGrid(latest.config.radius);
      const move = getAIMove(latest.board, player, grid, playerConfig.aiDifficulty);

      if (move) {
        dispatch({ type: 'EXECUTE_MOVE', from: move.from, to: move.to, player });
      } else {
        // AI 无合法移动，跳过回合
        dispatch({ type: 'SKIP_TURN' });
      }
    }, 600);

    return () => {
      if (aiTimerRef.current) {
        clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
    // 只在 currentPlayer 或 phase 变化时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayer, state.phase, state.moveHistory.length]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (aiTimerRef.current) {
        clearTimeout(aiTimerRef.current);
      }
    };
  }, []);

  // === 事件处理 ===

  const handleStartGame = useCallback(
    (config: GameConfig) => {
      startGame(config);
      setShowConfig(false);
    },
    [startGame],
  );

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleSkip = useCallback(() => {
    skipTurn();
  }, [skipTurn]);

  const handleExport = useCallback(() => {
    exportGame(state.config, state.initialBoard, state.moveHistory, state.winner);
  }, [state.config, state.initialBoard, state.moveHistory, state.winner]);

  const handleImport = useCallback(async () => {
    const data = await openImportDialog();
    if (data) {
      startGame(data.config);
      setTimeout(() => {
        // 重放移动记录（使用EXECUTE_MOVE逐帧重放）
        for (const move of data.moves) {
          dispatch({ type: 'EXECUTE_MOVE', from: move.from, to: move.to, player: move.player });
        }
      }, 100);
    }
  }, [startGame, dispatch]);

  const handleScreenshot = useCallback(() => {
    if (boardContainerRef.current) {
      captureScreenshot(boardContainerRef.current);
    }
  }, []);

  const handleOpenReplay = useCallback(() => {
    setShowReplay(true);
  }, []);

  const handleBackToConfig = useCallback(() => {
    setShowConfig(true);
    clearSelection();
  }, [clearSelection]);

  return (
    <div className="app">
      {showConfig ? (
        <ConfigPanel onStart={handleStartGame} />
      ) : (
        <div className="game-layout">
          <div className="game-left">
            <div ref={boardContainerRef} className="board-wrapper">
              <GameBoard state={state} onCellClick={selectCell} />
            </div>
          </div>
          <div className="game-right">
            <GameControls
              state={state}
              onReset={handleReset}
              onUndo={handleUndo}
              onSkip={handleSkip}
              onExport={handleExport}
              onImport={handleImport}
              onScreenshot={handleScreenshot}
              onOpenReplay={handleOpenReplay}
              onBackToConfig={handleBackToConfig}
            />
          </div>
        </div>
      )}

      {showReplay && (
        <ReplayModal
          config={state.config}
          moves={state.moveHistory}
          initialBoard={state.initialBoard}
          onClose={() => setShowReplay(false)}
        />
      )}
    </div>
  );
};

export default App;
