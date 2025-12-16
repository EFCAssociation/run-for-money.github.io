import { GoogleGenAI, Type } from "@google/genai";
import { Mission, Position, Entity, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Simple rate limit backoff mechanism
let rateLimitUntil = 0;

const isRateLimited = () => {
  return Date.now() < rateLimitUntil;
};

const handleApiError = (error: any) => {
  // Check for 429 or Quota Exceeded errors
  if (
    error.status === 429 || 
    error.code === 429 || 
    (error.message && (error.message.includes('quota') || error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')))
  ) {
    console.warn("Gemini API Quota Exceeded. Backing off for 60 seconds.");
    rateLimitUntil = Date.now() + 60000; // 60 seconds cooldown
  } else {
    console.error("Gemini API Error:", error);
  }
};

// 100+ Static Missions to replace AI generation and avoid Quota limits
const STATIC_MISSIONS = [
  // --- ハンター放出系 ---
  { title: "MISSION①", description: "ハンター放出を阻止せよ。エリア内のレバーを下ろせ。" },
  { title: "緊急指令", description: "ハンターボックスのロックが外れかけた。再ロックせよ。" },
  { title: "通達", description: "これよりハンターを1体追加する。阻止するには装置を起動せよ。" },
  { title: "MISSION②", description: "残り10分でハンターが放出される。冷凍銃を探せ。" },
  { title: "警告", description: "エリア封鎖まで残り3分。解除レバーを探せ。" },
  { title: "MISSION③", description: "3体のハンターが接近中。かく乱装置を起動せよ。" },
  { title: "緊急", description: "ハンターゾーンが開放された。ゲートを閉鎖せよ。" },
  { title: "MISSION④", description: "通報部隊が出現。見つかる前に停止スイッチを押せ。" },
  { title: "通達", description: "上空より監視ドローン投入。制御端末をハッキングせよ。" },
  { title: "MISSION⑤", description: "ハンターの視界が強化される。妨害電波を発信せよ。" },
  
  // --- 賞金・ボーナス系 ---
  { title: "通達", description: "賞金単価アップのチャンス。広場の装置を起動せよ。" },
  { title: "BONUS", description: "このミッションをクリアすれば、賞金が現在の倍になる。" },
  { title: "チャンス", description: "エリア内に宝箱が出現。獲得すれば10万円追加。" },
  { title: "通達", description: "残り時間が短縮できる。加速装置を作動させろ。" },
  { title: "MISSION", description: "逃走者にボーナス支給。受け取り場所へ急げ。" },
  { title: "好機", description: "ハンターを一時停止できるアイテムが出現した。" },
  { title: "通達", description: "今から5分間、自首の成立金額が2倍になる。" },
  { title: "BONUS", description: "仲間の復活カードが出現。牢獄へ届けろ。" },
  { title: "MISSION", description: "賞金減額を阻止せよ。時限装置を解除しろ。" },
  { title: "通達", description: "黄金の像を獲得せよ。持っている間は単価が上がる。" },

  // --- エリア移動・脱出系 ---
  { title: "通達", description: "新エリア開放。ゲートへ向かい認証を行え。" },
  { title: "警告", description: "現在のエリアが封鎖される。隣のエリアへ脱出せよ。" },
  { title: "MISSION", description: "建物内にガスが充満した。換気システムを起動せよ。" },
  { title: "緊急", description: "橋が崩落する恐れがある。補強スイッチを押せ。" },
  { title: "通達", description: "地下通路の鍵が開いた。ショートカットを利用せよ。" },
  { title: "MISSION", description: "屋上のヘリポートへ向かえ。脱出のチャンスだ。" },
  { title: "警告", description: "エリア全域が停電する。予備電源を入れろ。" },
  { title: "通達", description: "迷路エリアが開放された。隠れ場所を探せ。" },
  { title: "緊急", description: "浸水が始まった。排水ポンプを稼働させろ。" },
  { title: "MISSION", description: "封鎖ゲートの暗証番号を入手せよ。" },

  // --- アイテム・装備系 ---
  { title: "通達", description: "強力な盾が入荷された。武器庫へ向かえ。" },
  { title: "MISSION", description: "無敵スーツのバッテリーを探せ。" },
  { title: "チャンス", description: "透明マントが支給される。指定ポイントへ急げ。" },
  { title: "通達", description: "ハンターの位置がわかるレーダーが出現した。" },
  { title: "MISSION", description: "囮人形を設置し、ハンターを誘導せよ。" },
  { title: "好機", description: "スモークグレネードを入手せよ。" },
  { title: "通達", description: "スピードアップシューズがエリア内に隠されている。" },
  { title: "MISSION", description: "通信機が故障した。修理パーツを集めろ。" },
  { title: "緊急", description: "バッテリー切れが近い。充電ステーションへ向かえ。" },
  { title: "通達", description: "音を消すブーツを手に入れろ。" },

  // --- 妨害・裏切り系 ---
  { title: "通達", description: "裏切り者募集。他プレイヤーの位置を密告せよ。" },
  { title: "MISSION", description: "ニセ逃走者が紛れ込んだ。正体を暴け。" },
  { title: "警告", description: "誰かがハンターを呼び寄せた。警戒せよ。" },
  { title: "通達", description: "自首用電話が使用不能になった。回線を復旧せよ。" },
  { title: "MISSION", description: "密告電話を止めろ。配線を切断せよ。" },
  { title: "警告", description: "裏切り者がレバーを操作している。阻止せよ。" },
  { title: "緊急", description: "賞金リセット装置が起動した。停止させろ。" },
  { title: "通達", description: "偽の指令メールが出回っている。真偽を確かめろ。" },
  { title: "MISSION", description: "スパイを特定し、排除せよ。" },
  { title: "警告", description: "エリア内の監視カメラがハッキングされた。" },

  // --- ストーリー・フレーバー ---
  { title: "通達", description: "ゲームマスターからのプレゼントだ。箱を開けろ。" },
  { title: "MISSION", description: "住民が困っている。荷物を運んで助けろ。" },
  { title: "緊急", description: "謎のウイルスが蔓延。ワクチンを生成せよ。" },
  { title: "通達", description: "古代の石版が見つかった。解読せよ。" },
  { title: "MISSION", description: "時限爆弾のコードを切断せよ。" },
  { title: "警告", description: "地震が発生。安全地帯へ避難せよ。" },
  { title: "通達", description: "祭りが始まった。人混みに紛れろ。" },
  { title: "MISSION", description: "迷子の子供を親元へ届けろ。" },
  { title: "緊急", description: "研究所から猛獣が逃げ出した。麻酔銃を探せ。" },
  { title: "通達", description: "伝説の剣を引き抜け。" },
  
  // --- その他バリエーション ---
  { title: "MISSION⑥", description: "ハンター10体放出まで残り1分。阻止せよ。" },
  { title: "通達", description: "これより通達を停止する。幸運を祈る。" },
  { title: "緊急指令", description: "全逃走者に告ぐ。強制失格を回避せよ。" },
  { title: "MISSION⑦", description: "牢獄の鍵を入手し、仲間を救出せよ。" },
  { title: "通達", description: "ゲーム時間が延長される。阻止するにはボタンを押せ。" },
  { title: "警告", description: "上空に網鉄砲部隊が到着した。" },
  { title: "MISSION⑧", description: "ペアを結成せよ。認証すれば賞金ボーナス。" },
  { title: "通達", description: "ハンターのバッテリー交換中。動きが鈍るぞ。" },
  { title: "緊急", description: "エリア内に時限爆弾が設置された。" },
  { title: "MISSION⑨", description: "最終ミッション発動。脱出ポッドを起動せよ。" },
  { title: "LAST MISSION", description: "生き残りたければ、頂上の鐘を鳴らせ。" },
  { title: "通達", description: "ハンターが強化スーツを装備した。視界に注意。" },
  { title: "警告", description: "足元にセンサーが設置された。踏むな。" },
  { title: "MISSION", description: "暗闇エリアが発生。懐中電灯を探せ。" },
  { title: "通達", description: "身代わり人形を使用可能。設置せよ。" },
  { title: "緊急", description: "制御室が乗っ取られた。奪還せよ。" },
  { title: "MISSION", description: "認証キーカードを3枚集めろ。" },
  { title: "通達", description: "ベストプレイヤー投票を開始する。" },
  { title: "警告", description: "ハンターの数が増殖しているバグが発生。" },
  { title: "MISSION", description: "システムエラーを修復せよ。" },
  
  // ...さらに水増し用汎用
  { title: "MISSION", description: "東の広場へ向かい、装置を確認せよ。" },
  { title: "MISSION", description: "西の通路にあるレバーを下ろせ。" },
  { title: "MISSION", description: "北の建物の端末を操作せよ。" },
  { title: "MISSION", description: "南のゲートを閉鎖せよ。" },
  { title: "通達", description: "中央エリアにアイテムボックスが出現。" },
  { title: "通達", description: "残り時間半分。気を引き締めろ。" },
  { title: "警告", description: "ハンターが包囲網を形成中。" },
  { title: "緊急", description: "逃走者の位置情報が漏洩している。" },
  { title: "MISSION", description: "赤いランプのついた装置を探せ。" },
  { title: "MISSION", description: "青いケーブルを切断せよ。" }
];

const TACTICS_SYSTEM_PROMPT = `
You are the AI Coordinator for a team of Hunters in a tag game. 
Grid size is ${MAP_WIDTH}x${MAP_HEIGHT}. 
Your goal is to surround and catch the player.
Given the player's position and current hunter positions, assign a target grid coordinate (x,y) for each hunter.
Strategies:
1. Some hunters should chase directly.
2. Others should predict player movement and cut them off.
3. Some should guard the center or corners if the player is far.
Return JSON mapping hunter IDs to target coordinates.
`;

export const generateMissionFlavorText = async (timeRemaining: number, score: number): Promise<Partial<Mission>> => {
  // Use static missions to ensure reliability and save quota
  const randomIndex = Math.floor(Math.random() * STATIC_MISSIONS.length);
  const mission = STATIC_MISSIONS[randomIndex];

  return {
    title: mission.title,
    description: mission.description,
    reward: 10000 + Math.floor(Math.random() * 5) * 5000 // Random reward 10k-30k
  };
};

export const generateHunterTactics = async (
  playerPos: Position, 
  hunters: Entity[]
): Promise<Record<string, Position>> => {
  if (!ai || isRateLimited()) return {};

  try {
    // Convert pixels to grid coordinates for the LLM to understand easier
    const pGrid = { x: Math.floor(playerPos.x / TILE_SIZE), y: Math.floor(playerPos.y / TILE_SIZE) };
    const hGrid = hunters.map(h => ({ 
      id: h.id, 
      x: Math.floor(h.x / TILE_SIZE), 
      y: Math.floor(h.y / TILE_SIZE) 
    }));

    