import React, { useMemo } from 'react';
import { GameState, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, Position } from '../types';

interface MiniMapProps {
  gameState: GameState;
  obstacles: Set<string>;
}

export const MiniMap: React.FC<MiniMapProps> = ({ gameState, obstacles }) => {
  // Map dimensions in UI pixels
  const MAP_UI_SIZE = 160;
  const SCALE = MAP_UI_SIZE / MAP_WIDTH; // Scaling factor from grid to UI

  // Optimization: render obstacles only when mapSeed changes (implicitly via obstacles prop)
  const obstacleDots = useMemo(() => {
    const dots: React.ReactElement[] = [];
    obstacles.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      dots.push(
        <div
          key={`obs-${key}`}
          className="absolute bg-gray-500/50"
          style={{
            left: x * SCALE,
            top: y * SCALE,
            width: SCALE,
            height: SCALE,
          }}
        />
      );
    });
    return dots;
  }, [obstacles, SCALE]);

  const getEntityColor = (type: string) => {
    switch (type) {
      case 'player': return 'bg-green-500 border border-white z-20';
      case 'survivor': return 'bg-cyan-400 z-10';
      // Hunters are hidden, but if we needed them for debug: 'bg-red-600 z-10'
      default: return 'bg-white';
    }
  };

  return (
    <div 
      className="relative bg-black/80 border-2 border-gray-600 rounded-lg overflow-hidden shadow-2xl"
      style={{ width: MAP_UI_SIZE, height: MAP_UI_SIZE }}
    >
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-20" 
        style={{
           backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)',
           backgroundSize: `${SCALE * 4}px ${SCALE * 4}px`
        }}
      ></div>

      {/* Jishu Box */}
      <div 
        className="absolute bg-blue-500 border border-white animate-pulse z-10"
        style={{
          left: (gameState.jishuBoxPos.x / TILE_SIZE) * SCALE,
          top: (gameState.jishuBoxPos.y / TILE_SIZE) * SCALE,
          width: SCALE * 1.5,
          height: SCALE * 1.5,
          transform: 'translate(-25%, -25%)'
        }}
        title="自首ボックス"
      />

      {/* Mission Targets (Yellow) */}
      {gameState.missions.map(m => {
        if (!m.active || !m.targetPos) return null;
        return (
          <div 
            key={m.id}
            className="absolute bg-yellow-500 border border-white animate-ping z-10 rounded-full"
            style={{
              left: (m.targetPos.x / TILE_SIZE) * SCALE,
              top: (m.targetPos.y / TILE_SIZE) * SCALE,
              width: SCALE * 2,
              height: SCALE * 2,
              transform: 'translate(-50%, -50%)',
              opacity: 0.7
            }}
          />
        );
      })}

      {/* Obstacles */}
      {obstacleDots}

      {/* Entities (Hunters excluded) */}
      {gameState.entities.map(e => {
         if (e.type === 'hunter') return null; // Hide Hunters!
         
         return (
           <div
             key={e.id}
             className={`absolute rounded-full shadow-sm ${getEntityColor(e.type)}`}
             style={{
               left: (e.x / TILE_SIZE) * SCALE,
               top: (e.y / TILE_SIZE) * SCALE,
               width: e.type === 'player' ? SCALE * 1.5 : SCALE,
               height: e.type === 'player' ? SCALE * 1.5 : SCALE,
               transform: 'translate(-50%, -50%)',
               transition: 'all 0.1s linear'
             }}
           />
         );
      })}
    </div>
  );
};