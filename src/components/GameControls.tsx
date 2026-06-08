// ============================================================
// HexFlip — 游戏控制栏
// 回合信息、计分板、操作按钮
// ============================================================

import React from 'react';
import type { GameState } from '../types/game';
import { countPieces } from '../logic/gameEngine';

interface GameControlsProps {
  state: GameState;
  onReset: () => void;
  onUndo: () => void;
  onSkip: () => void;
  onExport: () => void;
  onImport: () => void;
  onScreenshot: () => void;
  onOpenReplay: () => void;
  onBackToConfig: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  state,
  onReset,
  onUndo,
  onSkip,
  onExport,
  onImport,
  onScreenshot,
  onOpenReplay,
  onBackToConfig,
}) => {
  const { config, currentPlayer, message, phase, winner } = state;
  const pieceCounts = countPieces(state.board, config.players.length);
  const currentPlayerConfig = config.players[currentPlayer];

  return (
    <div className="game-controls">
      {/* 状态消息 */}
      <div className={`game-message ${phase === 'finished' ? 'game-message-winner' : ''}`}>
        {phase === 'finished' && winner !== null ? (
          <span>🎉 {config.players[winner].name} 获胜！</span>
        ) : (
          <span>{message}</span>
        )}
      </div>

      {/* 回合指示器 */}
      {phase === 'playing' && (
        <div className="turn-indicator">
          <div
            className="turn-dot"
            style={{ background: currentPlayerConfig.color }}
          />
          <span className="turn-name">
            当前回合：{currentPlayerConfig.name}
            {currentPlayerConfig.isAI ? ' (AI)' : ''}
          </span>
        </div>
      )}

      {/* 计分板 */}
      <div className="scoreboard">
        {config.players.map((player, i) => (
          <div key={i} className={`score-item ${i === currentPlayer && phase === 'playing' ? 'active' : ''}`}>
            <div
              className="score-dot"
              style={{ background: player.color }}
            />
            <span className="score-name">{player.name}</span>
            <span className="score-count">{pieceCounts[i]}</span>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="control-buttons">
        <button className="btn-control" onClick={onReset} title="重置游戏">
          🔄 重置
        </button>
        <button
          className="btn-control"
          onClick={onUndo}
          disabled={state.moveHistory.length === 0}
          title="撤销上一步"
        >
          ↩️ 撤销
        </button>
        <button
          className="btn-control"
          onClick={onSkip}
          disabled={state.phase !== 'playing'}
          title="跳过当前回合"
        >
          ⏭ 跳过
        </button>
        <button className="btn-control" onClick={onScreenshot} title="截图保存">
          📸 截图
        </button>
        <button className="btn-control" onClick={onExport} title="导出棋局">
          💾 导出
        </button>
        <button className="btn-control" onClick={onImport} title="导入棋局">
          📂 导入
        </button>
        <button
          className="btn-control"
          onClick={onOpenReplay}
          disabled={state.moveHistory.length === 0}
          title="回放棋局"
        >
          ▶️ 回放
        </button>
        <button className="btn-control btn-back" onClick={onBackToConfig} title="返回配置">
          ⚙️ 配置
        </button>
      </div>
    </div>
  );
};

export default GameControls;
