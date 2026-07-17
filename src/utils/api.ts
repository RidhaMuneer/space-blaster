const API_URL = "http://localhost:3001/api";

export interface LeaderboardEntry {
  nickname: string;
  score: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/scores?limit=20`);
  if (!res.ok) return [];
  return res.json();
}

export async function submitScore(nickname: string, score: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nickname.trim().slice(0, 20), score: Math.floor(score) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
