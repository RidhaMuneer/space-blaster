interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  newlyUnlocked: boolean;
}

export interface AchievementStats {
  score: number;
  level: number;
  comboCount: number;
  bossKilled?: boolean;
  miniBossKilled?: boolean;
  perfectLevel?: boolean;
  grazeTotal?: number;
}

class AchievementSystem {
  achievements: AchievementDef[] = [
    { id: "first_kill", name: "First Blood", desc: "Destroy your first enemy", unlocked: false, newlyUnlocked: false },
    { id: "score_2500", name: "Rookie", desc: "Reach 2,500 points", unlocked: false, newlyUnlocked: false },
    { id: "score_5000", name: "Sharpshooter", desc: "Reach 5,000 points", unlocked: false, newlyUnlocked: false },
    { id: "score_10000", name: "Ace Pilot", desc: "Reach 10,000 points", unlocked: false, newlyUnlocked: false },
    { id: "win", name: "Galactic Hero", desc: "Win the game!", unlocked: false, newlyUnlocked: false },
    { id: "level_3", name: "Veteran", desc: "Reach level 3", unlocked: false, newlyUnlocked: false },
    { id: "level_5", name: "Elite", desc: "Reach level 5", unlocked: false, newlyUnlocked: false },
    { id: "level_10", name: "Commander", desc: "Reach level 10", unlocked: false, newlyUnlocked: false },
    { id: "combo_5", name: "Combo Master", desc: "Get a 5x combo", unlocked: false, newlyUnlocked: false },
    { id: "combo_10", name: "Unstoppable", desc: "Get a 10x combo", unlocked: false, newlyUnlocked: false },
    { id: "combo_20", name: "Berserker", desc: "Get a 20x combo", unlocked: false, newlyUnlocked: false },
    { id: "boss_kill", name: "Boss Slayer", desc: "Defeat a boss", unlocked: false, newlyUnlocked: false },
    { id: "miniBoss_kill", name: "Mini-Boss Hunter", desc: "Defeat a mini-boss", unlocked: false, newlyUnlocked: false },
    { id: "perfect_level", name: "Flawless", desc: "Clear a level without getting hit", unlocked: false, newlyUnlocked: false },
    { id: "graze_50", name: "Graze Master", desc: "Graze 50 enemy bullets", unlocked: false, newlyUnlocked: false },
    { id: "graze_100", name: "Daredevil", desc: "Graze 100 enemy bullets", unlocked: false, newlyUnlocked: false },
    { id: "drone_pilot", name: "Wingman", desc: "Deploy a combat drone", unlocked: false, newlyUnlocked: false },
  ];

  constructor() {
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem("spaceBlaster_achievements");
      if (saved) {
        const ids = JSON.parse(saved) as string[];
        for (const a of this.achievements) {
          if (ids.includes(a.id)) a.unlocked = true;
        }
      }
    } catch {}
  }

  save() {
    try {
      const ids = this.achievements.filter((a) => a.unlocked).map((a) => a.id);
      localStorage.setItem("spaceBlaster_achievements", JSON.stringify(ids));
    } catch {}
  }

  unlock(id: string): boolean {
    const a = this.achievements.find((a) => a.id === id);
    if (a && !a.unlocked) {
      a.unlocked = true;
      a.newlyUnlocked = true;
      this.save();
      return true;
    }
    return false;
  }

  check(stats: AchievementStats) {
    const { score, level, comboCount } = stats;
    if (score >= 100) this.unlock("first_kill");
    if (score >= 2500) this.unlock("score_2500");
    if (score >= 5000) this.unlock("score_5000");
    if (score >= 10000) this.unlock("score_10000");
    if (level >= 3) this.unlock("level_3");
    if (level >= 5) this.unlock("level_5");
    if (level >= 10) this.unlock("level_10");
    if (comboCount >= 5) this.unlock("combo_5");
    if (comboCount >= 10) this.unlock("combo_10");
    if (comboCount >= 20) this.unlock("combo_20");
    if (stats.bossKilled) this.unlock("boss_kill");
    if (stats.miniBossKilled) this.unlock("miniBoss_kill");
    if (stats.perfectLevel) this.unlock("perfect_level");
    if (stats.grazeTotal && stats.grazeTotal >= 50) this.unlock("graze_50");
    if (stats.grazeTotal && stats.grazeTotal >= 100) this.unlock("graze_100");
  }

  getNew(): AchievementDef[] {
    return this.achievements.filter((a) => a.newlyUnlocked);
  }

  clearNew() {
    for (const a of this.achievements) a.newlyUnlocked = false;
  }

  getUnlockedCount(): number {
    return this.achievements.filter((a) => a.unlocked).length;
  }

  getTotalCount(): number {
    return this.achievements.length;
  }
}

export class HighScore {
  static KEY = "spaceBlaster_highScore";

  static load(): number {
    try {
      return parseInt(localStorage.getItem(HighScore.KEY) || "0", 10);
    } catch {
      return 0;
    }
  }

  static save(score: number): boolean {
    try {
      const current = HighScore.load();
      if (score > current) {
        localStorage.setItem(HighScore.KEY, score.toString());
        return true;
      }
    } catch {}
    return false;
  }
}

export default AchievementSystem;
