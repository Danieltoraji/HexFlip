// ============================================================
// HexFlip — 游戏配置面板
// 设置玩家数量、颜色、AI、棋盘参数等
// ============================================================

import React, { useState } from 'react';
import type { GameConfig, PlayerConfig } from '../types/game';
import { DEFAULT_COLORS, DEFAULT_NAMES, AI_DIFFICULTY_LABELS } from '../types/game';

interface ConfigPanelProps {
  onStart: (config: GameConfig) => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ onStart }) => {
  const [playerCount, setPlayerCount] = useState(2);
  const [radius, setRadius] = useState(4);
  const [fillRatio, setFillRatio] = useState(0.6);
  const [turnOrder, setTurnOrder] = useState<'clockwise' | 'counterclockwise'>('clockwise');
  const [players, setPlayers] = useState<PlayerConfig[]>([
    { name: DEFAULT_NAMES[0], color: DEFAULT_COLORS[0], isAI: false, aiDifficulty: 'easy' },
    { name: DEFAULT_NAMES[1], color: DEFAULT_COLORS[1], isAI: false, aiDifficulty: 'easy' },
  ]);

  // 更新玩家数量
  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
    setPlayers((prev) => {
      const newPlayers: PlayerConfig[] = [];
      for (let i = 0; i < count; i++) {
        newPlayers.push(
          prev[i] || {
            name: DEFAULT_NAMES[i],
            color: DEFAULT_COLORS[i],
            isAI: false,
            aiDifficulty: 'easy',
          },
        );
      }
      return newPlayers;
    });
  };

  // 更新单个玩家配置
  const updatePlayer = (index: number, updates: Partial<PlayerConfig>) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...updates } : p)),
    );
  };

  const handleStart = () => {
    const config: GameConfig = {
      radius,
      fillRatio,
      playerCount,
      players: players.slice(0, playerCount),
      turnOrder,
    };
    onStart(config);
  };

  return (
    <div className="config-panel">
      <h1 className="config-title">🪄 HexFlip 六边形翻转棋</h1>
      <p className="config-subtitle">配置游戏参数，开始对战吧！</p>

      {/* 玩家数量 */}
      <div className="config-section">
        <label className="config-label">👥 玩家数量</label>
        <div className="button-group">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              className={`btn-option ${playerCount === n ? 'active' : ''}`}
              onClick={() => handlePlayerCountChange(n)}
            >
              {n} 人
            </button>
          ))}
        </div>
      </div>

      {/* 玩家配置 */}
      <div className="config-section">
        <label className="config-label">🎨 玩家设置</label>
        {players.slice(0, playerCount).map((player, i) => (
          <div key={i} className="player-config-row">
            <div className="player-color-dot" style={{ background: player.color }} />
            <input
              type="text"
              className="input-name"
              value={player.name}
              onChange={(e) => updatePlayer(i, { name: e.target.value })}
              maxLength={8}
            />
            <input
              type="color"
              className="input-color"
              value={player.color}
              onChange={(e) => updatePlayer(i, { color: e.target.value })}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={player.isAI}
                onChange={(e) => updatePlayer(i, { isAI: e.target.checked })}
              />
              AI
            </label>
            {player.isAI && (
              <select
                className="select-difficulty"
                value={player.aiDifficulty}
                onChange={(e) =>
                  updatePlayer(i, {
                    aiDifficulty: e.target.value as 'easy' | 'medium' | 'hard',
                  })
                }
              >
                <option value="easy">{AI_DIFFICULTY_LABELS.easy}</option>
                <option value="medium">{AI_DIFFICULTY_LABELS.medium}</option>
                <option value="hard">{AI_DIFFICULTY_LABELS.hard}</option>
              </select>
            )}
          </div>
        ))}
      </div>

      {/* 出手顺序 */}
      <div className="config-section">
        <label className="config-label">🔄 出手顺序</label>
        <div className="button-group">
          <button
            className={`btn-option ${turnOrder === 'clockwise' ? 'active' : ''}`}
            onClick={() => setTurnOrder('clockwise')}
          >
            顺时针
          </button>
          <button
            className={`btn-option ${turnOrder === 'counterclockwise' ? 'active' : ''}`}
            onClick={() => setTurnOrder('counterclockwise')}
          >
            逆时针
          </button>
        </div>
      </div>

      {/* 棋盘半径 */}
      <div className="config-section">
        <label className="config-label">
          📐 棋盘半径：<strong>{radius}</strong>
        </label>
        <input
          type="range"
          min={2}
          max={7}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="slider"
        />
        <span className="slider-hint">
          格子数：{3 * radius * radius + 3 * radius + 1}
        </span>
      </div>

      {/* 初始占空比 */}
      <div className="config-section">
        <label className="config-label">
          🎯 初始占空比：<strong>{(fillRatio * 100).toFixed(0)}%</strong>
        </label>
        <input
          type="range"
          min={0.3}
          max={0.9}
          step={0.05}
          value={fillRatio}
          onChange={(e) => setFillRatio(Number(e.target.value))}
          className="slider"
        />
      </div>

      {/* 开始按钮 */}
      <button className="btn-start" onClick={handleStart}>
        🚀 开始游戏
      </button>
    </div>
  );
};

export default ConfigPanel;
