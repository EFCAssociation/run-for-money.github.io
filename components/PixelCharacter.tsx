import React from 'react';
import { Direction, Entity, TILE_SIZE } from '../types';

interface PixelCharacterProps {
  entity: Entity;
}

export const PixelCharacter: React.FC<PixelCharacterProps> = ({ entity }) => {
  const isPlayer = entity.type === 'player';
  const isSurvivor = entity.type === 'survivor';
  
  // Default Colors if not specified
  const mainColor = entity.color || (isPlayer ? '#22c55e' : '#06b6d4'); // green-500 : cyan-500
  const bandanaColor = isPlayer ? '#2563eb' : '#f97316'; // blue-600 : orange-500

  return (
    <div
      className="absolute transition-transform duration-75 pointer-events-none"
      style={{
        left: entity.x,
        top: entity.y,
        width: TILE_SIZE,
        height: TILE_SIZE,
        zIndex: Math.floor(entity.y), // Y-sort for 2.5D depth
        transform: `translate3d(0, -50%, 0)` // Anchor point at feet
      }}
    >
      {/* Shadow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-3 bg-black/40 rounded-[50%] blur-[2px]" />

      {/* Body Sprite Container */}
      <div className={`relative w-full h-full animate-bounce-slight ${entity.isMoving ? 'animate-waddle' : ''}`}>
        
        {isPlayer || isSurvivor ? (
          // Runner Sprite
          <div className="w-8 h-12 mx-auto relative">
            {/* Head */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 bg-yellow-200 rounded-sm border-2 border-black z-20">
              <div className="w-full h-2 top-0 absolute" style={{ backgroundColor: bandanaColor }}></div> {/* Bandana */}
            </div>
            {/* Body */}
            <div 
              className="absolute top-5 left-1/2 -translate-x-1/2 w-6 h-5 rounded-sm border-2 border-black z-10"
              style={{ backgroundColor: mainColor }}
            >
               <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-3 bg-white/20 text-[6px] text-center leading-[10px]">
                 {isPlayer ? '01' : entity.id.replace('s', '')}
               </div>
            </div>
            {/* Legs */}
            <div className={`absolute top-9 left-1 w-2 h-3 bg-blue-900 border border-black ${entity.isMoving ? 'animate-leg-l' : ''}`}></div>
            <div className={`absolute top-9 right-1 w-2 h-3 bg-blue-900 border border-black ${entity.isMoving ? 'animate-leg-r' : ''}`}></div>
          </div>
        ) : (
          // Hunter Sprite (Black Suit, Sunglasses)
          <div className="w-8 h-12 mx-auto relative">
            {/* Head */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 bg-yellow-200 rounded-sm border-2 border-black z-20">
               <div className="absolute top-2 left-0 w-full h-1 bg-black"></div> {/* Sunglasses */}
               <div className="absolute top-0 w-full h-1 bg-black"></div> {/* Hair */}
            </div>
            {/* Body */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-7 h-6 bg-black rounded-sm border-2 border-gray-800 z-10">
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-full bg-white"></div> {/* Tie area */}
               <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-black"></div> {/* Tie */}
            </div>
             {/* Legs */}
             <div className={`absolute top-10 left-1 w-2 h-3 bg-black border border-gray-800 ${entity.isMoving ? 'animate-leg-l' : ''}`}></div>
            <div className={`absolute top-10 right-1 w-2 h-3 bg-black border border-gray-800 ${entity.isMoving ? 'animate-leg-r' : ''}`}></div>
          </div>
        )}
      </div>

      {/* Detection Ring (Only for Hunters) */}
      {entity.type === 'hunter' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border border-red-500/10 bg-red-500/5 pointer-events-none" />
      )}
      
      {/* CPU Intent Indicator (Surrendering) */}
      {isSurvivor && entity.intent === 'surrender' && (
         <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-[8px] text-white px-1 rounded animate-pulse whitespace-nowrap border border-white">
            自首中
         </div>
      )}
    </div>
  );
};