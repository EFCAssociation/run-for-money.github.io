import React, { useMemo } from 'react';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, Position, Mission, MapTheme } from '../types';

interface GameMapProps {
  seed: number;
  obstacles: Set<string>; // Set of "x,y" strings
  jishuBoxPos?: Position;
  missions?: Mission[];
  theme?: MapTheme;
}

export const GameMap: React.FC<GameMapProps> = ({ seed, obstacles, jishuBoxPos, missions, theme = MapTheme.TECH }) => {
  
  // Theme configuration
  const themeConfig = useMemo(() => {
    switch (theme) {
      case MapTheme.SAKURA:
        return {
          bg: '#2d1b2e',
          grid1: '#4a2c3a',
          grid2: 'transparent',
          obsMain: 'bg-pink-800',
          obsBorder: 'border-pink-600',
          obsTop: 'bg-pink-700',
          pattern: "opacity-20 bg-[url('https://www.transparenttextures.com/patterns/flowers.png')]",
          floorPattern: "bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"
        };
      case MapTheme.RUINS:
        return {
          bg: '#1c1c1a',
          grid1: '#2c2c2a',
          grid2: 'transparent',
          obsMain: 'bg-stone-700',
          obsBorder: 'border-stone-500',
          obsTop: 'bg-stone-600',
          pattern: "opacity-30 bg-[url('https://www.transparenttextures.com/patterns/wall-4-light.png')]",
          floorPattern: "bg-[url('https://www.transparenttextures.com/patterns/crissxcross.png')]"
        };
      case MapTheme.TECH:
      default:
        return {
          bg: '#2a2a2a',
          grid1: '#333',
          grid2: 'transparent',
          obsMain: 'bg-slate-700',
          obsBorder: 'border-slate-500',
          obsTop: 'bg-slate-600',
          pattern: "opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]",
          floorPattern: "bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"
        };
    }
  }, [theme]);

  const obstacleElements = useMemo(() => {
    const elements: React.ReactElement[] = [];
    obstacles.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      const pixelX = x * TILE_SIZE;
      const pixelY = y * TILE_SIZE;

      elements.push(
        <div
          key={key}
          className="absolute"
          style={{
            left: pixelX,
            top: pixelY,
            width: TILE_SIZE,
            height: TILE_SIZE, // Floor footprint
            zIndex: pixelY + TILE_SIZE - 1 // Sort by bottom of tile
          }}
        >
          {/* 3D Block Representation */}
          <div className="relative w-full h-full">
             {/* Top Face */}
             <div className={`absolute w-full h-[120%] ${themeConfig.obsTop} border-t-4 border-l-4 ${themeConfig.obsBorder} -top-[50%] left-0 rounded-sm shadow-xl`}>
                {/* Texture Detail */}
                <div className={`w-full h-full ${themeConfig.pattern}`}></div>
             </div>
             {/* Side/Shadow */}
             <div className="absolute bottom-0 w-full h-1/2 bg-black/50 blur-sm transform scale-90 translate-y-1"></div>
          </div>
        </div>
      );
    });
    return elements;
  }, [obstacles, themeConfig]);

  return (
    <div
      className="absolute top-0 left-0 transition-colors duration-500"
      style={{
        width: MAP_WIDTH * TILE_SIZE,
        height: MAP_HEIGHT * TILE_SIZE,
        backgroundColor: themeConfig.bg,
        backgroundImage: `
          linear-gradient(${themeConfig.grid1} 1px, ${themeConfig.grid2} 1px),
          linear-gradient(90deg, ${themeConfig.grid1} 1px, ${themeConfig.grid2} 1px)
        `,
        backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
        backgroundPosition: '-1px -1px'
      }}
    >
      {/* Decorative Floor Texture */}
      <div className={`absolute inset-0 opacity-10 pointer-events-none ${themeConfig.floorPattern}`}></div>
      
      {/* Falling Sakura Petals for Sakura Theme */}
      {theme === MapTheme.SAKURA && (
         <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({length: 20}).map((_, i) => (
               <div 
                  key={i}
                  className="absolute w-2 h-2 bg-pink-400/60 rounded-full animate-pulse"
                  style={{
                     left: `${Math.random() * 100}%`,
                     top: `${Math.random() * 100}%`,
                     animation: `float ${3 + Math.random() * 5}s infinite ease-in-out`
                  }}
               />
            ))}
            <style>{`
               @keyframes float {
                  0%, 100% { transform: translateY(0) translateX(0); opacity: 0.5; }
                  50% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
               }
            `}</style>
         </div>
      )}

      {obstacleElements}

      {/* Jishu Box (Blue Phone Booth) */}
      {jishuBoxPos && (
        <div 
          className="absolute"
          style={{
             left: jishuBoxPos.x,
             top: jishuBoxPos.y,
             width: TILE_SIZE,
             height: TILE_SIZE,
             zIndex: jishuBoxPos.y + TILE_SIZE
          }}
        >
           {/* Shadow */}
           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-4 bg-black/50 blur-sm"></div>
           
           {/* Booth Structure */}
           <div className="absolute bottom-0 left-0 w-full h-[200%] bg-blue-600 border-2 border-blue-300 rounded-sm shadow-lg overflow-hidden flex items-center justify-center -translate-y-[10%]">
              <div className="w-[80%] h-[70%] bg-blue-900/50 border border-blue-400/50"></div>
              {/* Telephone Icon */}
              <div className="absolute top-2 w-full text-center text-white text-[8px] font-bold">自首</div>
           </div>
        </div>
      )}

      {/* Mission Objectives (Yellow Lever/Box) */}
      {missions && missions.map(m => {
        if (!m.active || !m.targetPos) return null;
        return (
          <div 
            key={m.id}
            className="absolute"
            style={{
               left: m.targetPos.x,
               top: m.targetPos.y,
               width: TILE_SIZE,
               height: TILE_SIZE,
               zIndex: m.targetPos.y + TILE_SIZE
            }}
          >
             {/* Shadow */}
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-4 bg-black/50 blur-sm"></div>
             
             {/* Mission Box Structure */}
             <div className="absolute bottom-0 left-0 w-full h-[120%] bg-yellow-500 border-2 border-yellow-200 rounded-sm shadow-lg overflow-hidden flex items-center justify-center -translate-y-[10%] animate-bounce-slight">
                <div className="w-[80%] h-[50%] bg-yellow-700/30 border border-yellow-400/50 relative">
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-2 h-6 bg-red-600 rounded"></div> {/* Lever handle */}
                </div>
                {/* Exclamation */}
                <div className="absolute -top-10 w-full text-center text-yellow-400 text-xl font-bold animate-bounce">!</div>
             </div>
          </div>
        );
      })}
    </div>
  );
};