import React, { useEffect, useState, useRef } from 'react';
import { GameMap } from './components/GameMap';
import { PixelCharacter } from './components/PixelCharacter';
import { MiniMap } from './components/MiniMap';
import { JishuPhone } from './components/JishuPhone';
import { useGameEngine } from './hooks/useGameEngine';
import { GameStatus, TILE_SIZE, GameDifficulty, MapTheme } from './types';
import { generateMissionFlavorText } from './services/geminiService';
import { VirtualJoystick } from './components/VirtualJoystick';

// Icons
const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const HandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 3a1 1 0 012 0v5.5a.5.5 0 001 0V4a1 1 0 112 0v4.5a.5.5 0 001 0V6a1 1 0 112 0v5c0 5.25-4.375 9-10 9S1 16.25 1 11V6a1 1 0 112 0v1.5a.5.5 0 001 0V3z" clipRule="evenodd" />
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const RunnerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
     <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
  </svg>
);

const ColorSwatch = ({ color, selected, onClick }: { color: string, selected: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-10 h-10 rounded border-2 mr-2 mb-2 transition-transform ${selected ? 'border-white scale-110 shadow-lg' : 'border-gray-600 hover:scale-105'}`}
    style={{ backgroundColor: color }}
  />
);

export default function App() {
  const { gameState, startGame, resetGame, surrender, updateSettings, obstacles, setJoystickInput, addMission, completeMission } = useGameEngine();
  const [missionAlert, setMissionAlert] = useState<{title: string, desc: string} | null>(null);
  const [loadingMission, setLoadingMission] = useState(false);
  const [isDialingJishu, setIsDialingJishu] = useState(false);
  const lastMissionTimeRef = useRef<number>(-1);

  // Camera tracking
  const player = gameState.entities.find(e => e.type === 'player');
  const windowSize = useRef({ w: window.innerWidth, h: window.innerHeight });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      windowSize.current = { w: window.innerWidth, h: window.innerHeight };
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Monitor dialing state
  useEffect(() => {
    // If player walks away or gets caught while dialing, cancel it
    if (isDialingJishu) {
       if (!gameState.canSurrender || gameState.status !== GameStatus.PLAYING) {
          setIsDialingJishu(false);
       }
    }
  }, [gameState.canSurrender, gameState.status, isDialingJishu]);

  // Periodic Mission Generation via Gemini
  useEffect(() => {
    if (gameState.status !== GameStatus.PLAYING) return;
    
    const time = gameState.timeRemaining;
    const duration = gameState.settings.duration;
    
    // Trigger every 30 seconds (but not at start)
    if (time > 0 && time < duration && time % 30 === 0) {
       // Prevent duplicate triggers for the same timestamp
       if (lastMissionTimeRef.current !== time) {
          lastMissionTimeRef.current = time;
          triggerMission();
       }
    }
  }, [gameState.timeRemaining, gameState.status]);

  const triggerMission = async () => {
    setLoadingMission(true);
    
    // Get text from AI (or static list if AI is disabled/limited)
    const mission = await generateMissionFlavorText(gameState.timeRemaining, gameState.score);
    
    // Add to game engine state (generates position)
    const title = mission.title || "通達";
    const desc = mission.description || "ハンターから逃げ切れ。";
    addMission(title, desc);
    
    setMissionAlert({
      title: title,
      desc: desc
    });
    setLoadingMission(false);

    // Auto dismiss after 8 seconds (slightly longer for reading)
    setTimeout(() => {
      setMissionAlert(null);
    }, 8000);
  };

  const handleJishuSuccess = () => {
    setIsDialingJishu(false);
    surrender();
  };
  
  const handleCompleteMission = () => {
    if (gameState.nearbyMissionId) {
       completeMission(gameState.nearbyMissionId);
       // Show success feedback logic could be here, but simpler to use alert for now
       setMissionAlert({
          title: "MISSION CLEAR",
          desc: "ミッションクリア！ボーナスを獲得。"
       });
       setTimeout(() => setMissionAlert(null), 3000);
    }
  };

  // Camera transform - Floor coordinates to prevent sub-pixel jitter
  const camX = player ? Math.floor(-player.x + windowSize.current.w / 2 - TILE_SIZE/2) : 0;
  const camY = player ? Math.floor(-player.y + windowSize.current.h / 2 - TILE_SIZE/2) : 0;

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative font-sans text-white select-none">
      
      {/* --- Game World Layer --- */}
      <div 
        className="absolute will-change-transform"
        style={{ transform: `translate3d(${camX}px, ${camY}px, 0)` }}
      >
        <GameMap 
          seed={gameState.mapSeed} 
          obstacles={obstacles} 
          jishuBoxPos={gameState.jishuBoxPos} 
          missions={gameState.missions}
          theme={gameState.settings.theme}
        />
        {gameState.entities.map(entity => (
          <PixelCharacter key={entity.id} entity={entity} />
        ))}
      </div>

      {/* --- Vignette & Scanlines Effect --- */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.8)_100%)] z-10"></div>
      <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}></div>

      {/* --- HUD Layer --- */}
      {gameState.status === GameStatus.PLAYING && (
        <div className="absolute inset-0 z-50 pointer-events-none p-4 flex flex-col justify-between">
          
          {/* Top Bar: Timer and Score */}
          <div className="flex justify-between items-start">
            <div className="flex gap-4">
              {/* Timer - Tosochu Style */}
              <div className="flex flex-col items-center transform -skew-x-12 bg-black/80 border-2 border-lime-400 px-6 py-2 shadow-[0_0_15px_rgba(132,204,22,0.5)]">
                 <div className="text-lime-400 text-xs font-bold tracking-widest mb-1 font-pixel">TIMER</div>
                 <div className="text-4xl md:text-5xl font-mono font-bold text-white tracking-wider drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">
                    {Math.floor(gameState.timeRemaining / 60)}:{(gameState.timeRemaining % 60).toString().padStart(2, '0')}<span className="text-xl">.00</span>
                 </div>
              </div>

              {/* Score - Tosochu Style */}
              <div className="flex flex-col items-center transform -skew-x-12 bg-black/80 border-2 border-red-500 px-6 py-2 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                 <div className="text-red-500 text-xs font-bold tracking-widest mb-1 font-pixel">PRIZE</div>
                 <div className="text-3xl md:text-4xl font-mono font-bold text-white tracking-tighter">
                    ¥{gameState.score.toLocaleString()}
                 </div>
              </div>
            </div>

            {/* Radar Map (Top Right) */}
            <div className="pointer-events-auto hover:scale-110 transition-transform origin-top-right">
               <MiniMap gameState={gameState} obstacles={obstacles} />
               <div className="mt-1 flex items-center justify-end gap-2 text-[10px] font-bold text-white bg-black/50 px-2 rounded">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>YOU</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span>CPU</span>
                  {/* Hunter Legend Removed */}
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500"></span>BOX</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span>MSN</span>
               </div>
            </div>
          </div>

          {/* Mission Notification (Tosochu Email Style) */}
          {(missionAlert || loadingMission) && (
            <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[90%] md:w-[400px] bg-black/95 border-y-4 border-yellow-500 shadow-2xl overflow-hidden animate-slide-in-right pointer-events-auto">
               <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 p-2 flex items-center justify-between text-black">
                  <span className="font-extrabold flex items-center gap-2 text-sm uppercase tracking-wider">
                     <span className="bg-black text-yellow-500 px-2 py-0.5 rounded text-xs">MAIL</span>
                     {loadingMission ? "RECEIVING..." : missionAlert?.title}
                  </span>
               </div>
               <div className="p-6 relative">
                  {/* Grid background for tech look */}
                  <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                  
                  {loadingMission ? (
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-800 rounded w-full animate-pulse"></div>
                      <div className="h-4 bg-gray-800 rounded w-2/3 animate-pulse"></div>
                    </div>
                  ) : (
                    <p className="text-lg text-white font-medium leading-relaxed font-sans relative z-10 drop-shadow-md">
                      {missionAlert?.desc}
                    </p>
                  )}
               </div>
            </div>
          )}

          {/* Bottom Status & Actions */}
          <div className="flex justify-between items-end w-full pb-8">
             <div className="flex flex-col gap-2">
                {/* Survivors Count */}
                <div className="flex items-center gap-3 bg-black/60 px-4 py-2 rounded-r-full border-l-4 border-cyan-400 backdrop-blur-sm">
                   <div className="text-cyan-400 animate-pulse"><RunnerIcon /></div>
                   <div className="flex flex-col">
                      <span className="text-[10px] text-gray-300 uppercase tracking-wider">SURVIVORS</span>
                      <span className="text-2xl font-bold font-mono leading-none">{gameState.survivorsRemaining + 1} <span className="text-sm text-gray-400">/ {gameState.settings.survivorCount + 1}</span></span>
                   </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden md:flex w-16 h-16 bg-black/50 rounded-full border-2 border-white/20 items-center justify-center backdrop-blur">
                    <div className="w-12 h-12 bg-green-500 rounded-full animate-pulse shadow-[0_0_15px_#22c55e]"></div>
                  </div>
                  <div className="bg-black/60 px-3 py-1 rounded text-xs text-white/70 backdrop-blur-sm">
                     BPM: <span className="text-green-400 font-bold text-lg">145</span>
                  </div>
               </div>
             </div>
             
             <div className="flex gap-4">
                {/* Mission Action Button */}
                {gameState.nearbyMissionId && (
                   <button 
                     onClick={handleCompleteMission}
                     className="pointer-events-auto bg-yellow-600 hover:bg-yellow-500 border-4 border-yellow-300 text-white font-bold py-4 px-6 rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.8)] animate-bounce"
                   >
                     <div className="text-xl font-black tracking-widest flex items-center gap-2">
                        <HandIcon /> レバー
                     </div>
                     <div className="text-xs mt-1">ミッション実行</div>
                   </button>
                )}

                {/* Surrender Button (Appears when near Jishu Box) */}
                {gameState.canSurrender && !isDialingJishu && (
                  <button 
                    onClick={() => setIsDialingJishu(true)}
                    className="pointer-events-auto bg-blue-600 hover:bg-blue-500 border-4 border-blue-300 text-white font-bold py-4 px-8 rounded-xl shadow-[0_0_30px_rgba(37,99,235,0.8)] animate-bounce"
                  >
                    <div className="text-2xl font-black tracking-widest flex items-center gap-2">
                       <PhoneIcon /> 自首する
                    </div>
                    <div className="text-xs mt-1">現在の賞金を獲得</div>
                  </button>
                )}
             </div>
          </div>
        </div>
      )}
      
      {/* Jishu Phone Overlay */}
      {isDialingJishu && (
         <JishuPhone 
            onSuccess={handleJishuSuccess} 
            onCancel={() => setIsDialingJishu(false)} 
         />
      )}

      {/* --- Virtual Controls --- */}
      {gameState.status === GameStatus.PLAYING && (
         <div className="absolute inset-0 pointer-events-none z-40">
           <div className="w-full h-full pointer-events-auto">
              <VirtualJoystick onMove={setJoystickInput} />
           </div>
         </div>
      )}

      {/* --- Game Menu (IDLE) --- */}
      {gameState.status === GameStatus.IDLE && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center text-center p-8">
          <h1 className="text-5xl md:text-8xl font-pixel text-yellow-400 mb-2 filter drop-shadow-[4px_4px_0_#b45309] italic tracking-tighter">
            逃走中
          </h1>
          <p className="text-white text-sm tracking-[0.5em] mb-8 uppercase opacity-80">Run for Money</p>
          
          <div className="bg-gray-900/80 p-6 rounded-lg border border-gray-700 backdrop-blur-md w-full max-w-md h-[75vh] overflow-y-auto">
             <div className="flex items-center gap-2 mb-4 text-gray-300 border-b border-gray-700 pb-2 sticky top-0 bg-gray-900 z-10">
                <SettingsIcon /> <span className="font-bold">ゲーム設定</span>
             </div>

             {/* Player Color Setting */}
             <div className="mb-4 text-left">
                <label className="text-xs text-gray-400 uppercase tracking-wide">キャラカラー</label>
                <div className="flex flex-wrap mt-2">
                   {[
                      '#22c55e', // Green
                      '#ef4444', // Red
                      '#3b82f6', // Blue
                      '#eab308', // Yellow
                      '#a855f7', // Purple
                      '#ec4899', // Pink
                      '#f97316', // Orange
                      '#06b6d4', // Cyan
                      '#6366f1', // Indigo
                      '#10b981', // Emerald
                   ].map(color => (
                      <ColorSwatch 
                         key={color} 
                         color={color} 
                         selected={gameState.settings.playerColor === color}
                         onClick={() => updateSettings({ playerColor: color })}
                      />
                   ))}
                </div>
             </div>
             
             {/* Map Theme Setting */}
             <div className="mb-4 text-left">
                <label className="text-xs text-gray-400 uppercase tracking-wide">エリアテーマ</label>
                <div className="flex gap-2 mt-2">
                  {[
                     { val: MapTheme.TECH, label: 'TECH' },
                     { val: MapTheme.SAKURA, label: 'SAKURA' },
                     { val: MapTheme.RUINS, label: 'RUINS' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => updateSettings({ theme: opt.val })}
                      className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${gameState.settings.theme === opt.val ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
             </div>

             {/* Duration Setting */}
             <div className="mb-4 text-left">
                <label className="text-xs text-gray-400 uppercase tracking-wide">制限時間</label>
                <div className="flex gap-2 mt-2">
                  {[60, 180, 300].map(time => (
                    <button
                      key={time}
                      onClick={() => updateSettings({ duration: time })}
                      className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${gameState.settings.duration === time ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      {time / 60}分
                    </button>
                  ))}
                </div>
             </div>

             {/* Survivors Count Setting */}
             <div className="mb-4 text-left">
                <label className="text-xs text-gray-400 uppercase tracking-wide">逃走者数 (仲間)</label>
                <div className="flex gap-2 mt-2">
                  {[
                     { label: 'SOLO', count: 0 },
                     { label: '3人', count: 2 },
                     { label: '5人', count: 4 },
                     { label: '10人', count: 9 }
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => updateSettings({ survivorCount: opt.count })}
                      className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${gameState.settings.survivorCount === opt.count ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
             </div>

             {/* Difficulty Setting */}
             <div className="mb-6 text-left">
                <label className="text-xs text-gray-400 uppercase tracking-wide">難易度 (速度/AI)</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { val: GameDifficulty.EASY, label: 'EASY', desc: '遅い', defaultCount: 3 },
                    { val: GameDifficulty.NORMAL, label: 'NORMAL', desc: '普通', defaultCount: 5 },
                    { val: GameDifficulty.HARD, label: 'HARD', desc: '速い', defaultCount: 8 },
                    { val: GameDifficulty.GEMINI, label: 'GEMINI AI', desc: 'AI連携', defaultCount: 5 },
                    { val: GameDifficulty.HUNTER_100, label: '100体', desc: 'NIGHTMARE', defaultCount: 100 },
                  ].map(diff => (
                    <button
                      key={diff.val}
                      onClick={() => updateSettings({ difficulty: diff.val, hunterCount: diff.defaultCount })}
                      className={`p-2 rounded text-left transition-all border ${
                        gameState.settings.difficulty === diff.val 
                          ? 'bg-red-900/50 border-red-500 text-white' 
                          : 'bg-gray-800 border-transparent text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      <div className="font-bold text-sm">{diff.label}</div>
                      <div className="text-[10px] opacity-70">{diff.desc}</div>
                    </button>
                  ))}
                </div>
             </div>

             {/* Hunter Count Slider (Available for all except 100-mode) */}
             {gameState.settings.difficulty !== GameDifficulty.HUNTER_100 && (
                <div className="mb-6 text-left animate-fade-in">
                   <label className="text-xs text-blue-400 uppercase tracking-wide font-bold">ハンター放出数: {gameState.settings.hunterCount}</label>
                   <input 
                      type="range" 
                      min="1" 
                      max="50" 
                      value={gameState.settings.hunterCount} 
                      onChange={(e) => updateSettings({ hunterCount: parseInt(e.target.value) })}
                      className="w-full mt-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                   />
                   <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>1体</span>
                      <span>50体</span>
                   </div>
                </div>
             )}

             <button 
               onClick={startGame}
               className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xl rounded shadow-[0_0_20px_rgba(220,38,38,0.6)] transition-all hover:scale-105 relative overflow-hidden group mb-4"
             >
               <span className="relative z-10">GAME START</span>
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1s_infinite]"></div>
             </button>
          </div>
        </div>
      )}

      {/* CAUGHT Screen (Red) */}
      {gameState.status === GameStatus.CAUGHT && (
        <div className="absolute inset-0 z-[60] bg-red-600 flex flex-col items-center justify-center text-center p-8 animate-fade-in">
          <div className="bg-black w-full py-12 mb-8 transform -skew-x-12 border-y-8 border-white">
            <div className="text-6xl md:text-9xl font-black text-red-600 tracking-widest transform skew-x-12" style={{textShadow: '2px 2px 0 #fff'}}>
              確保
            </div>
          </div>
          <p className="text-2xl text-white font-bold mb-8">ハンターに捕まった...</p>
          <div className="text-4xl font-mono text-white mb-8 bg-black/30 px-6 py-2">
             賞金: ¥0
          </div>
          <button 
            onClick={resetGame} 
            className="px-8 py-3 bg-white text-red-900 font-bold hover:bg-gray-200 rounded shadow-lg"
          >
            タイトルへ戻る
          </button>
        </div>
      )}

      {/* WON Screen (Escape Success - Gold) */}
       {gameState.status === GameStatus.WON && (
        <div className="absolute inset-0 z-[60] bg-yellow-500 flex flex-col items-center justify-center text-center p-8 animate-fade-in">
           <div className="bg-black w-full py-12 mb-8 transform -skew-x-12 border-y-8 border-white">
            <div className="text-5xl md:text-8xl font-black text-yellow-500 tracking-widest transform skew-x-12" style={{textShadow: '2px 2px 0 #fff'}}>
              逃走成功
            </div>
          </div>
          <p className="text-xl md:text-2xl text-black font-bold mb-2">獲得賞金</p>
          <div className="text-5xl md:text-6xl font-mono font-black text-white drop-shadow-lg mb-12 bg-black/20 px-8 py-4 rounded">
            ¥{gameState.score.toLocaleString()}
          </div>
          <button 
            onClick={resetGame}
            className="px-8 py-3 bg-black text-yellow-500 font-bold hover:bg-gray-800 rounded shadow-lg"
          >
            タイトルへ戻る
          </button>
        </div>
      )}

      {/* SURRENDERED Screen (Blue) */}
      {gameState.status === GameStatus.SURRENDERED && (
        <div className="absolute inset-0 z-[60] bg-blue-600 flex flex-col items-center justify-center text-center p-8 animate-fade-in">
           <div className="bg-black w-full py-12 mb-8 transform -skew-x-12 border-y-8 border-white">
            <div className="text-5xl md:text-8xl font-black text-blue-500 tracking-widest transform skew-x-12" style={{textShadow: '2px 2px 0 #fff'}}>
              自首成立
            </div>
          </div>
          <p className="text-xl md:text-2xl text-white font-bold mb-2">獲得賞金</p>
          <div className="text-5xl md:text-6xl font-mono font-black text-white drop-shadow-lg mb-12 bg-black/20 px-8 py-4 rounded">
            ¥{gameState.score.toLocaleString()}
          </div>
          <button 
            onClick={resetGame}
            className="px-8 py-3 bg-white text-blue-600 font-bold hover:bg-gray-200 rounded shadow-lg"
          >
            タイトルへ戻る
          </button>
        </div>
      )}

      <style>{`
        @keyframes waddle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        .animate-waddle { animation: waddle 0.4s infinite ease-in-out; }
        
        @keyframes leg-l {
          0%, 100% { height: 8px; transform: translateY(0); }
          50% { height: 4px; transform: translateY(-2px); }
        }
        @keyframes leg-r {
           0%, 100% { height: 4px; transform: translateY(-2px); }
           50% { height: 8px; transform: translateY(0); }
        }
        .animate-leg-l { animation: leg-l 0.4s infinite; }
        .animate-leg-r { animation: leg-r 0.4s infinite; }

        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}