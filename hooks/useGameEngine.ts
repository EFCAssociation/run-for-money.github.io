import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  GameState, 
  GameStatus, 
  Entity, 
  Direction, 
  GameDifficulty,
  GameSettings,
  TILE_SIZE, 
  MAP_WIDTH, 
  MAP_HEIGHT,
  PLAYER_SPEED,
  HUNTER_VISION_RADIUS,
  REWARD_PER_SECOND,
  Mission,
  MapTheme
} from '../types';
import { generateHunterTactics } from '../services/geminiService';

export const useGameEngine = () => {
  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.IDLE,
    timeRemaining: 300,
    score: 0,
    entities: [],
    missions: [],
    currentMissionIndex: 0,
    mapSeed: 1,
    settings: {
      duration: 300,
      difficulty: GameDifficulty.NORMAL,
      survivorCount: 4,
      theme: MapTheme.TECH,
      hunterCount: 5,
      playerColor: '#22c55e' // Default green
    },
    jishuBoxPos: { x: 0, y: 0 },
    canSurrender: false,
    nearbyMissionId: null,
    survivorsRemaining: 0
  });

  const [obstacles, setObstacles] = useState<Set<string>>(new Set());
  const obstaclesRef = useRef<Set<string>>(new Set());

  // Refs for mutable state in the game loop
  const stateRef = useRef(gameState);
  const inputRef = useRef<{ [key: string]: boolean }>({});
  const joystickRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 }); 
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const geminiTacticsTimerRef = useRef<number>(0);

  // Helper to sync stateRef with react state updates for settings
  const updateSettings = (newSettings: Partial<GameSettings>) => {
    setGameState(prev => {
      const next = { ...prev, settings: { ...prev.settings, ...newSettings } };
      if (prev.status === GameStatus.IDLE && newSettings.duration) {
         next.timeRemaining = newSettings.duration;
      }
      stateRef.current = next;
      return next;
    });
  };

  const resetGame = useCallback(() => {
    const idleState: GameState = {
      ...stateRef.current,
      status: GameStatus.IDLE,
      entities: [],
      missions: [], // Clear missions
      canSurrender: false,
      nearbyMissionId: null,
      survivorsRemaining: 0
    };
    stateRef.current = idleState;
    setGameState(idleState);
  }, []);

  const surrender = useCallback(() => {
    if (stateRef.current.status === GameStatus.PLAYING && stateRef.current.canSurrender) {
      setGameState(prev => ({ ...prev, status: GameStatus.SURRENDERED }));
      stateRef.current.status = GameStatus.SURRENDERED;
    }
  }, []);

  const completeMission = useCallback((missionId: string) => {
    setGameState(prev => {
      const updatedMissions = prev.missions.map(m => 
        m.id === missionId ? { ...m, active: false, completed: true } : m
      );
      // Give reward (e.g. bonus score)
      const bonus = 10000;
      const next = { 
        ...prev, 
        missions: updatedMissions,
        score: prev.score + bonus,
        nearbyMissionId: null 
      };
      stateRef.current = next;
      return next;
    });
  }, []);

  // Add a new mission with a physical location
  const addMission = useCallback((title: string, description: string) => {
    // Find a valid spot for the mission objective
    let mx = 0, my = 0;
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 100) {
      mx = Math.floor(Math.random() * (MAP_WIDTH - 4)) + 2;
      my = Math.floor(Math.random() * (MAP_HEIGHT - 4)) + 2;
      if (!obstaclesRef.current.has(`${mx},${my}`)) {
        valid = true;
      }
      attempts++;
    }

    const newMission: Mission = {
      id: `m-${Date.now()}`,
      title,
      description,
      reward: 10000,
      active: true,
      completed: false,
      targetPos: { x: mx * TILE_SIZE, y: my * TILE_SIZE }
    };

    setGameState(prev => {
      const next = { ...prev, missions: [...prev.missions, newMission] };
      stateRef.current = next; // Sync ref immediately
      return next;
    });
  }, []);

  const startGame = useCallback(() => {
    const newObstacles = new Set<string>();
    for (let i = 0; i < 150; i++) {
      const x = Math.floor(Math.random() * MAP_WIDTH);
      const y = Math.floor(Math.random() * MAP_HEIGHT);
      if (x > 5 || y > 5) { 
        newObstacles.add(`${x},${y}`);
      }
    }
    
    // Determine Jishu Box Position
    let jx = Math.floor(Math.random() * (MAP_WIDTH - 10)) + 10;
    let jy = Math.floor(Math.random() * (MAP_HEIGHT - 10)) + 10;
    
    // Clear obstacle at Jishu box and immediate surroundings to ensure hunters can enter
    for(let dx=-1; dx<=1; dx++) {
        for(let dy=-1; dy<=1; dy++) {
             newObstacles.delete(`${jx+dx},${jy+dy}`);
        }
    }
    
    setObstacles(newObstacles);
    obstaclesRef.current = newObstacles;

    const diff = stateRef.current.settings.difficulty;
    const survivorCount = stateRef.current.settings.survivorCount;

    // Use settings.hunterCount by default
    let hunterCount = stateRef.current.settings.hunterCount;
    let baseHunterSpeed = 4.8;
    
    // Configure speed based on Difficulty
    if (diff === GameDifficulty.EASY) {
       baseHunterSpeed = 3.5;
    } else if (diff === GameDifficulty.NORMAL) {
       baseHunterSpeed = 4.8;
    } else if (diff === GameDifficulty.HARD) {
       baseHunterSpeed = 5.3;
    } else if (diff === GameDifficulty.GEMINI) {
       baseHunterSpeed = 5.0; 
    } else if (diff === GameDifficulty.HUNTER_100) {
       hunterCount = 100; // Force 100 for this mode
       baseHunterSpeed = 4.2; // Slightly reduced speed for mass hunters to make it playable
    }

    const entities: Entity[] = [];

    entities.push({
      id: 'player',
      type: 'player',
      x: TILE_SIZE * 2,
      y: TILE_SIZE * 2,
      speed: PLAYER_SPEED,
      direction: Direction.DOWN,
      isMoving: false,
      color: stateRef.current.settings.playerColor
    });

    for (let i = 0; i < survivorCount; i++) {
       const sx = Math.floor(Math.random() * 20) + 10;
       const sy = Math.floor(Math.random() * 20) + 10;
       entities.push({
          id: `s${i}`,
          type: 'survivor',
          x: sx * TILE_SIZE,
          y: sy * TILE_SIZE,
          speed: PLAYER_SPEED * 0.9,
          direction: Direction.DOWN,
          isMoving: false,
          stuckFrames: 0,
          intent: 'survive'
       });
    }

    const hPositions = [
      { x: MAP_WIDTH - 2, y: MAP_HEIGHT - 2 },
      { x: MAP_WIDTH - 2, y: 2 },
      { x: 2, y: MAP_HEIGHT - 2 },
      { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
      { x: MAP_WIDTH - 10, y: 10 },
      { x: 10, y: MAP_HEIGHT - 10 },
      { x: MAP_WIDTH / 2, y: 2 },
      { x: 2, y: MAP_HEIGHT / 2 },
    ];

    for (let i = 0; i < hunterCount; i++) {
      let hx, hy;
      
      // For massive hunter counts, spawn randomly across map (avoiding player start)
      if (hunterCount > 10) {
        let safe = false;
        while (!safe) {
          hx = Math.floor(Math.random() * MAP_WIDTH);
          hy = Math.floor(Math.random() * MAP_HEIGHT);
          // Keep away from player start area (0,0 to 10,10)
          if (hx > 10 || hy > 10) safe = true;
        }
      } else {
        const pos = hPositions[i % hPositions.length];
        hx = pos.x;
        hy = pos.y;
      }

      entities.push({
        id: `h${i}`,
        type: 'hunter',
        x: TILE_SIZE * hx,
        y: TILE_SIZE * hy,
        speed: baseHunterSpeed,
        direction: Direction.DOWN,
        isMoving: true,
        stuckFrames: 0
      });
    }

    const initialState: GameState = {
      ...stateRef.current,
      status: GameStatus.PLAYING,
      timeRemaining: stateRef.current.settings.duration,
      score: 0,
      entities: entities,
      missions: [],
      currentMissionIndex: 0,
      mapSeed: Math.random(),
      jishuBoxPos: { x: jx * TILE_SIZE, y: jy * TILE_SIZE },
      canSurrender: false,
      nearbyMissionId: null,
      survivorsRemaining: survivorCount
    };

    setGameState(initialState);
    stateRef.current = initialState;
    lastTimeRef.current = performance.now();
    geminiTacticsTimerRef.current = 0;
    
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    gameLoop(performance.now());
  }, []);

  const checkCollision = (x: number, y: number, isPlayer: boolean) => {
    if (x < 0 || x > MAP_WIDTH * TILE_SIZE - TILE_SIZE || y < 0 || y > MAP_HEIGHT * TILE_SIZE - TILE_SIZE) {
      return true;
    }
    const padding = 12;
    const box = {
      left: x + padding,
      right: x + TILE_SIZE - padding,
      top: y + TILE_SIZE / 2,
      bottom: y + TILE_SIZE - 2
    };
    const points = [
      [box.left, box.top], [box.right, box.top],
      [box.left, box.bottom], [box.right, box.bottom]
    ];
    const currentObstacles = obstaclesRef.current;
    for (const [px, py] of points) {
      const gx = Math.floor(px / TILE_SIZE);
      const gy = Math.floor(py / TILE_SIZE);
      if (currentObstacles.has(`${gx},${gy}`)) return true;
    }
    return false;
  };

  const gameLoop = async (time: number) => {
    if (stateRef.current.status !== GameStatus.PLAYING) return;

    lastTimeRef.current = time;
    let entities = [...stateRef.current.entities];
    const playerIndex = entities.findIndex(e => e.type === 'player');
    if (playerIndex === -1) return;
    
    const player = { ...entities[playerIndex] };
    let dx = 0, dy = 0;

    if (inputRef.current['ArrowUp'] || inputRef.current['w']) dy -= 1;
    if (inputRef.current['ArrowDown'] || inputRef.current['s']) dy += 1;
    if (inputRef.current['ArrowLeft'] || inputRef.current['a']) dx -= 1;
    if (inputRef.current['ArrowRight'] || inputRef.current['d']) dx += 1;

    if (joystickRef.current.x !== 0 || joystickRef.current.y !== 0) {
      dx = joystickRef.current.x;
      dy = joystickRef.current.y;
    }

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const scale = len > 1 ? 1 / len : 1; 
      dx *= scale; dy *= scale;
    }

    const moveX = dx * player.speed;
    const moveY = dy * player.speed;

    if (!checkCollision(player.x + moveX, player.y, true)) player.x += moveX;
    if (!checkCollision(player.x, player.y + moveY, true)) player.y += moveY;
    
    player.isMoving = len > 0.1;
    if (player.isMoving) {
      if (Math.abs(dx) > Math.abs(dy)) player.direction = dx > 0 ? Direction.RIGHT : Direction.LEFT;
      else player.direction = dy > 0 ? Direction.DOWN : Direction.UP;
    }
    entities[playerIndex] = player;

    // Check Jishu Box Distance
    const jBox = stateRef.current.jishuBoxPos;
    const distToBox = Math.sqrt((player.x - jBox.x) ** 2 + (player.y - jBox.y) ** 2);
    const nearBox = distToBox < TILE_SIZE * 1.5;
    if (nearBox !== stateRef.current.canSurrender) {
      stateRef.current.canSurrender = nearBox;
      setGameState(prev => ({ ...prev, canSurrender: nearBox }));
    }

    // Check Active Missions Distance
    let foundMissionId = null;
    const activeMissions = stateRef.current.missions.filter(m => m.active && !m.completed && m.targetPos);
    
    activeMissions.forEach(m => {
       if (m.targetPos) {
          const dist = Math.sqrt((player.x - m.targetPos.x) ** 2 + (player.y - m.targetPos.y) ** 2);
          if (dist < TILE_SIZE * 1.5) {
             foundMissionId = m.id;
          }
       }
    });
    
    if (foundMissionId !== stateRef.current.nearbyMissionId) {
       stateRef.current.nearbyMissionId = foundMissionId;
       setGameState(prev => ({ ...prev, nearbyMissionId: foundMissionId }));
    }

    if (stateRef.current.settings.difficulty === GameDifficulty.GEMINI) {
       if (time - geminiTacticsTimerRef.current > 5000) {
          geminiTacticsTimerRef.current = time;
          generateHunterTactics(player, entities.filter(e => e.type === 'hunter'))
            .then(tactics => {
               const currentEnts = stateRef.current.entities;
               stateRef.current.entities = currentEnts.map(e => {
                 if (tactics[e.id]) return { ...e, targetPos: tactics[e.id] };
                 return e;
               });
            });
       }
    }

    const activeHunters = entities.filter(e => e.type === 'hunter');
    
    for (let i = 0; i < entities.length; i++) {
      const ent = { ...entities[i] };
      
      // >>> Survivor AI <<<
      if (ent.type === 'survivor') {
         // Chance to decide to surrender
         if (ent.intent !== 'surrender' && Math.random() < 0.0005) { // Small chance per frame
            ent.intent = 'surrender';
         }

         let sdx = 0, sdy = 0;
         
         if (ent.intent === 'surrender') {
            // Move towards Jishu Box
            const jBox = stateRef.current.jishuBoxPos;
            const dist = Math.sqrt((ent.x - jBox.x)**2 + (ent.y - jBox.y)**2);
            
            if (dist < TILE_SIZE) {
               // Successfully surrendered
               entities.splice(i, 1);
               stateRef.current.survivorsRemaining -= 1;
               i--; // adjust index
               continue;
            } else {
               const angle = Math.atan2(jBox.y - ent.y, jBox.x - ent.x);
               sdx = Math.cos(angle) * ent.speed;
               sdy = Math.sin(angle) * ent.speed;
            }
         } else {
             // Normal Survival Logic
             let closestHunterDist = 9999;
             let closestHunter: Entity | null = null;
             activeHunters.forEach(h => {
                const dist = Math.sqrt((ent.x - h.x)**2 + (ent.y - h.y)**2);
                if (dist < closestHunterDist) { closestHunterDist = dist; closestHunter = h; }
             });

             let sChaseMode = false;
             if (closestHunter && closestHunterDist < HUNTER_VISION_RADIUS * 1.2) {
                 sChaseMode = true;
                 const angle = Math.atan2(ent.y - closestHunter.y, ent.x - closestHunter.x);
                 sdx = Math.cos(angle) * ent.speed;
                 sdy = Math.sin(angle) * ent.speed;
             } else {
                 if (Math.random() < 0.05) ent.direction = Math.floor(Math.random() * 4);
                 if (Math.random() < 0.3) {
                    const s = ent.speed * 0.4;
                    if (ent.direction === Direction.UP) sdy = -s;
                    if (ent.direction === Direction.DOWN) sdy = s;
                    if (ent.direction === Direction.LEFT) sdx = -s;
                    if (ent.direction === Direction.RIGHT) sdx = s;
                 }
             }
             if (sChaseMode) { /* Keep direction set by angle logic */ }
         }

         let sMovedX = false, sMovedY = false;
         if (!checkCollision(ent.x + sdx, ent.y, false)) { ent.x += sdx; sMovedX = true; }
         if (!checkCollision(ent.x, ent.y + sdy, false)) { ent.y += sdy; sMovedY = true; }
         
         // Fix if stuck while surrendering/running
         if ((ent.intent === 'surrender' || Math.abs(sdx) > 0.1) && !sMovedX && !sMovedY) {
             // Try random direction to unstuck
             ent.x += (Math.random() - 0.5) * TILE_SIZE;
             ent.y += (Math.random() - 0.5) * TILE_SIZE;
         }

         ent.isMoving = sMovedX || sMovedY;
         entities[i] = ent;
      }

      // >>> Hunter AI <<<
      if (ent.type === 'hunter') {
        const hunter = ent;
        let target: Entity | null = null;
        let minDist = 9999;
        
        // 1. Detect Player/Survivors
        const pDist = Math.sqrt((player.x - hunter.x) ** 2 + (player.y - hunter.y) ** 2);
        minDist = pDist; target = player;

        entities.forEach(s => {
           if (s.type === 'survivor') {
              const d = Math.sqrt((s.x - hunter.x) ** 2 + (s.y - hunter.y) ** 2);
              if (d < minDist) { minDist = d; target = s; }
           }
        });

        // Catch logic
        if (target && minDist < TILE_SIZE * 0.5) {
           if (target.type === 'player') {
              stateRef.current.status = GameStatus.CAUGHT;
              setGameState({ ...stateRef.current });
              return;
           } else if (target.type === 'survivor') {
              entities.splice(entities.findIndex(e => e.id === target!.id), 1);
              stateRef.current.survivorsRemaining -= 1;
              i--; // adjust loop index as array shrank
              continue; 
           }
        }

        let hdx = 0, hdy = 0;
        let chaseMode = false;
        const vision = stateRef.current.settings.difficulty === GameDifficulty.GEMINI 
            ? HUNTER_VISION_RADIUS * 0.8 : HUNTER_VISION_RADIUS;

        // --- NEW LOGIC: Priority System ---
        
        // Priority 1: Visible Survivor (Standard Chase)
        if (target && minDist < vision) {
          chaseMode = true;
          const angle = Math.atan2(target.y - hunter.y, target.x - hunter.x);
          hdx = Math.cos(angle) * hunter.speed;
          hdy = Math.sin(angle) * hunter.speed;
          hunter.targetPos = undefined;
        } 
        else {
           // Not chasing visibly. Decide patrol target.
           
           if (!hunter.targetPos || Math.random() < 0.02) { // Retarget occasionally
              
              // Priority 2: Swarm Jishu Box (if player is there)
              // 60% chance to go to box if player near it
              if (stateRef.current.canSurrender && Math.random() < 0.6) {
                  const jBox = stateRef.current.jishuBoxPos;
                  // Add jitter so they don't all stack on one pixel
                  hunter.targetPos = {
                      x: jBox.x + (Math.random() - 0.5) * TILE_SIZE * 4,
                      y: jBox.y + (Math.random() - 0.5) * TILE_SIZE * 4
                  };
              } 
              // Priority 3: Camp Active Mission (if exists)
              // 40% chance if mission active
              else if (activeMissions.length > 0 && Math.random() < 0.4) {
                 const m = activeMissions[Math.floor(Math.random() * activeMissions.length)];
                 if (m.targetPos) {
                    hunter.targetPos = {
                        x: m.targetPos.x + (Math.random() - 0.5) * TILE_SIZE * 3,
                        y: m.targetPos.y + (Math.random() - 0.5) * TILE_SIZE * 3
                    };
                 }
              }
              // Priority 4: Random Patrol
              else {
                 let rx = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;
                 let ry = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
                 hunter.targetPos = { x: rx * TILE_SIZE, y: ry * TILE_SIZE };
              }
           }

           // Move towards targetPos
           if (hunter.targetPos) {
             const tx = hunter.targetPos.x;
             const ty = hunter.targetPos.y;
             const tDistSq = (tx - hunter.x) ** 2 + (ty - hunter.y) ** 2;
             
             if (tDistSq > TILE_SIZE) {
                const angle = Math.atan2(ty - hunter.y, tx - hunter.x);
                hdx = Math.cos(angle) * hunter.speed;
                hdy = Math.sin(angle) * hunter.speed;
             } else {
               hunter.targetPos = undefined; // Reached
             }
           }
        }

        let movedX = false, movedY = false;
        if (!checkCollision(hunter.x + hdx, hunter.y, false)) { hunter.x += hdx; movedX = true; } 
        if (!checkCollision(hunter.x, hunter.y + hdy, false)) { hunter.y += hdy; movedY = true; }

        // Anti-stuck
        if ((Math.abs(hdx) > 0.1 || Math.abs(hdy) > 0.1) && !movedX && !movedY) {
           hunter.stuckFrames = (hunter.stuckFrames || 0) + 1;
        } else {
           hunter.stuckFrames = 0;
        }

        if ((hunter.stuckFrames || 0) > 20) {
           hunter.targetPos = undefined; 
           hunter.stuckFrames = 0;
           // Hop out
           hunter.x += (Math.random() - 0.5) * TILE_SIZE; 
        }

        if (Math.abs(hdx) > Math.abs(hdy)) hunter.direction = hdx > 0 ? Direction.RIGHT : Direction.LEFT;
        else if (Math.abs(hdy) > Math.abs(hdx)) hunter.direction = hdy > 0 ? Direction.DOWN : Direction.UP;
        
        hunter.isMoving = movedX || movedY;
        entities[i] = hunter;
      }
    }

    stateRef.current.entities = entities;
    
    setGameState(prev => ({
      ...prev,
      entities,
      survivorsRemaining: stateRef.current.survivorsRemaining,
      nearbyMissionId: stateRef.current.nearbyMissionId
    }));

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (gameState.status === GameStatus.PLAYING) {
      interval = setInterval(() => {
        setGameState(prev => {
          const newTime = prev.timeRemaining - 1;
          const newScore = prev.score + REWARD_PER_SECOND; 
          
          if (newTime <= 0) {
            return { ...prev, timeRemaining: 0, status: GameStatus.WON, score: newScore };
          }
          stateRef.current.timeRemaining = newTime;
          stateRef.current.score = newScore;
          return { ...prev, timeRemaining: newTime, score: newScore };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState.status]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { inputRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { inputRef.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const setJoystickInput = (x: number, y: number) => {
    joystickRef.current = { x, y };
  };

  return {
    gameState,
    setGameState,
    startGame,
    resetGame,
    surrender,
    updateSettings,
    obstacles,
    setJoystickInput,
    addMission,
    completeMission
  };
};