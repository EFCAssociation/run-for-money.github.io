export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED', // Used for mission alerts
  CAUGHT = 'CAUGHT',
  WON = 'WON',
  SURRENDERED = 'SURRENDERED' // New status for Jishu
}

export enum Direction {
  DOWN = 0,
  UP = 1,
  LEFT = 2,
  RIGHT = 3
}

export enum GameDifficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
  GEMINI = 'GEMINI', // AI Director
  HUNTER_100 = 'HUNTER_100' // 100 Hunters Mode
}

export enum MapTheme {
  TECH = 'TECH',
  SAKURA = 'SAKURA',
  RUINS = 'RUINS'
}

export interface Position {
  x: number;
  y: number;
}

export interface Entity extends Position {
  id: string;
  type: 'player' | 'hunter' | 'npc' | 'survivor';
  speed: number;
  direction: Direction;
  isMoving: boolean;
  targetPos?: Position; // For AI pathfinding/Gemini commands
  stuckFrames?: number; // To detect if stuck against wall
  color?: string; // For customization
  intent?: 'survive' | 'surrender'; // CPU Intent
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  reward: number;
  active: boolean;
  completed: boolean;
  targetPos?: Position;
}

export interface GameSettings {
  duration: number; // seconds
  difficulty: GameDifficulty;
  survivorCount: number; // Number of CPU survivors (0 = SOLO)
  theme: MapTheme;
  hunterCount: number; // Custom count for all modes
  playerColor: string; // Player skin color (hex or tailwind class)
}

export interface GameState {
  status: GameStatus;
  timeRemaining: number;
  score: number;
  entities: Entity[];
  missions: Mission[];
  currentMissionIndex: number;
  mapSeed: number;
  settings: GameSettings;
  jishuBoxPos: Position; // Position of the surrender box
  canSurrender: boolean; // Is player near the box?
  nearbyMissionId: string | null; // ID of the mission player is standing near
  survivorsRemaining: number;
}

export const TILE_SIZE = 48;
export const MAP_WIDTH = 40;
export const MAP_HEIGHT = 40;
export const PLAYER_SPEED = 5.0; 
export const HUNTER_VISION_RADIUS = TILE_SIZE * 7;
// Prize money per second
export const REWARD_PER_SECOND = 200;