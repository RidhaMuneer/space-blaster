import Enemy from "../enemy/enemy";
import type { EnemyType } from "../enemy/enemy";
import Player from "../player/player";
import ScoreBox from "../player/score-box";
import CollisionCheck from "../utils/collision-checker";
import Controls from "../utils/controls";
import SoundManager from "../utils/sound-manager";
import ParticleSystem from "../particles/particle";
import PowerUp from "../powerup/power-up";
import type { PowerUpType } from "../powerup/power-up";
import AchievementSystem, { HighScore, type AchievementStats } from "../utils/achievements";
// Leaderboard / online score submission is disabled for now (client-side only).
// import { getLeaderboard, submitScore, type LeaderboardEntry } from "../utils/api";

type GameState = "menu" | "playing" | "paused" | "gameover" | "won";
type MenuScreen = "main" | "settings";

interface DiffConfig {
  label: string;
  lives: number;
  speedMult: number;
  spawnMult: number;
}

// `lives` here is the number of starting hearts for the mode. Bumped up so the
// game is more forgiving and easier to progress through.
const DIFFICULTIES: Record<string, DiffConfig> = {
  easy: { label: "EASY", lives: 8, speedMult: 0.7, spawnMult: 1.4 },
  normal: { label: "NORMAL", lives: 5, speedMult: 1.0, spawnMult: 1.0 },
  hard: { label: "HARD", lives: 3, speedMult: 1.3, spawnMult: 0.7 },
};

interface StarDef {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  isDestroyed: boolean;
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  timer: number;
  yOffset: number;
  color: string;
  startTime: number;
}

interface LevelUpAnim {
  level: number;
  timer: number;
  stageName: string;
}

interface StageTheme {
  name: string;
  starColor: string;
  nearColor: string;
  bgColor: string;
  accentColor: string;
}

const STAGE_THEMES: StageTheme[] = [
  { name: "Deep Space", starColor: "#ffffff", nearColor: "#b3e5fc", bgColor: "#0a0a1a", accentColor: "#00e5ff" },
  { name: "Nebula", starColor: "#ffccbc", nearColor: "#ff7043", bgColor: "#1a0808", accentColor: "#ff5252" },
  { name: "Alien Space", starColor: "#c8e6c9", nearColor: "#76ff03", bgColor: "#080e08", accentColor: "#76ff03" },
  { name: "Void", starColor: "#ce93d8", nearColor: "#e040fb", bgColor: "#0a001a", accentColor: "#e040fb" },
];

// "LEADERBOARD" removed for now (client-side only). "SETTINGS" removed too.
const MAIN_MENU_ITEMS = ["START GAME"];

class Game {
  ctx: CanvasRenderingContext2D;
  player: Player;
  enemies: Enemy[] = [];
  lastEnemyRespawned: number = 0;
  controls: Controls;
  scoreBox: ScoreBox;
  soundManager: SoundManager;
  particleSystem: ParticleSystem;
  state: GameState = "menu";
  menuScreen: MenuScreen = "main";
  menuSelection: number = 0;
  starLayers: StarDef[][] = [];
  level: number = 1;
  levelUpAnim: LevelUpAnim | null = null;
  scorePopups: ScorePopup[] = [];
  powerUps: PowerUp[] = [];
  enemyBullets: EnemyBullet[] = [];
  spawnWarnings: { x: number; timer: number }[] = [];
  mouseX: number | null = null;
  autoFire: boolean = true;
  difficultyKey: string = "normal";
  difficulty: DiffConfig = DIFFICULTIES.normal;
  achievements: AchievementSystem;
  difficultyIndex: number = 1;
  // Leaderboard state disabled for now (client-side only).
  // leaderboard: LeaderboardEntry[] = [];
  // leaderboardDirty: boolean = true;
  // leaderboardBtnBounds: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };
  menuBtnBounds: { x: number; y: number; w: number; h: number }[] = [];
  diffCardBounds: { x: number; y: number; w: number; h: number }[] = [];
  // On-screen action buttons (pause / resume / restart / menu), repopulated
  // every frame by whichever overlay is drawn. Tapped/clicked via Controls.
  actionButtons: { id: string; x: number; y: number; w: number; h: number }[] = [];
  backBtnBounds: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };
  WIN_SCORE = 25000;
  bossThisLevel: boolean = false;
  bossSpawned: boolean = false;
  miniBossThisLevel: boolean = false;
  miniBossSpawned: boolean = false;
  nextFormationTime: number = 0;
  grazeCooldown: number = 0;
  shakeTime: number = 0;
  shakeMag: number = 0;
  shakeX: number = 0;
  shakeY: number = 0;
  comboMilestone: number = 0;
  shootingStars: { x: number; y: number; vx: number; vy: number; len: number; life: number; maxLife: number }[] = [];
  nebulae: { x: number; y: number; r: number; dx: number; dy: number; tone: number }[] = [];

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.soundManager = new SoundManager();
    this.player = new Player(this);
    this.scoreBox = new ScoreBox();
    this.particleSystem = new ParticleSystem();
    this.achievements = new AchievementSystem();
    this.controls = new Controls(this);
    this.controls.initControls();
    this.createStarLayers();
    this.createNebulae();
    // this.setupLeaderboardUI();
  }

  createNebulae() {
    this.nebulae = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      this.nebulae.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        r: 180 + Math.random() * 220,
        dx: (Math.random() - 0.5) * 0.08,
        dy: 0.05 + Math.random() * 0.12,
        tone: Math.random(),
      });
    }
  }

  shake(mag: number, time: number) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  createStarLayers() {
    const configs = [
      { count: 80, speedR: [0.15, 0.4], sizeR: [0.5, 1.2], alphaR: [0.3, 0.6] },
      { count: 50, speedR: [0.4, 0.9], sizeR: [1, 2], alphaR: [0.5, 0.8] },
      { count: 20, speedR: [0.9, 1.8], sizeR: [1.5, 3], alphaR: [0.6, 1] },
    ];
    for (const c of configs) {
      const layer: StarDef[] = [];
      for (let i = 0; i < c.count; i++) {
        layer.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          size: Math.random() * (c.sizeR[1] - c.sizeR[0]) + c.sizeR[0],
          speed: Math.random() * (c.speedR[1] - c.speedR[0]) + c.speedR[0],
          alpha: Math.random() * (c.alphaR[1] - c.alphaR[0]) + c.alphaR[0],
        });
      }
      this.starLayers.push(layer);
    }
  }

  getStageTheme(): StageTheme {
    if (this.level <= 5) return STAGE_THEMES[0];
    if (this.level <= 10) return STAGE_THEMES[1];
    if (this.level <= 15) return STAGE_THEMES[2];
    return STAGE_THEMES[3];
  }

  cycleDifficulty(dir: number) {
    const keys = ["easy", "normal", "hard"];
    this.difficultyIndex = (this.difficultyIndex + dir + 3) % 3;
    this.setDifficulty(keys[this.difficultyIndex]);
  }

  setDifficulty(key: string) {
    if (DIFFICULTIES[key]) {
      this.difficultyKey = key;
      this.difficulty = DIFFICULTIES[key];
    }
  }

  cycleMenuSelection(dir: number) {
    if (this.menuScreen === "main") {
      this.menuSelection = (this.menuSelection + dir + MAIN_MENU_ITEMS.length) % MAIN_MENU_ITEMS.length;
    } else if (this.menuScreen === "settings") {
      this.menuSelection = Math.max(0, Math.min(1, this.menuSelection + dir));
    }
  }

  activateMenuSelection() {
    if (this.menuScreen === "main") {
      switch (this.menuSelection) {
        case 0: this.startGame(); break;
        // case 1: this.menuScreen = "settings"; break; // settings disabled
        // case 2: this.openLeaderboard(); break; // leaderboard disabled
      }
    }
    // Settings screen disabled (removed from the menu). Mute is still available
    // in-game via the "M" key.
    // else if (this.menuScreen === "settings") {
    //   if (this.menuSelection === 0) this.toggleMute();
    //   else if (this.menuSelection === 1) this.menuScreen = "main";
    // }
  }

  backToMenu() {
    this.state = "menu";
    this.menuScreen = "main";
    this.mouseX = null;
    this.canvas.style.cursor = "default";
    // this.leaderboardDirty = true;
  }

  // --- Leaderboard / name-entry disabled for now (client-side only) ---
  // openLeaderboard() {
  //   this.state = "leaderboard";
  //   this.leaderboardDirty = true;
  // }

  // async fetchLeaderboard() {
  //   this.leaderboardDirty = false;
  //   this.leaderboard = await getLeaderboard();
  // }

  // setupLeaderboardUI() {
  //   document.getElementById("submit-score-btn")!.addEventListener("click", () => this.submitNameEntry());
  //   document.getElementById("skip-score-btn")!.addEventListener("click", () => this.hideNameEntry());
  //   document.getElementById("nickname-input")!.addEventListener("keydown", (e) => {
  //     if (e.key === "Enter") this.submitNameEntry();
  //   });
  // }

  // showNameEntry() {
  //   const overlay = document.getElementById("score-submit")!;
  //   document.getElementById("submit-score")!.textContent = this.player.score.toString();
  //   overlay.classList.add("show");
  //   const input = document.getElementById("nickname-input") as HTMLInputElement;
  //   input.value = "";
  //   setTimeout(() => input.focus(), 100);
  // }

  // hideNameEntry() {
  //   document.getElementById("score-submit")!.classList.remove("show");
  // }

  // async submitNameEntry() {
  //   const input = document.getElementById("nickname-input") as HTMLInputElement;
  //   const name = input.value.trim();
  //   if (!name) return;
  //   await submitScore(name, this.player.score);
  //   this.hideNameEntry();
  //   this.leaderboardDirty = true;
  // }

  requestPointerLock() {
    try { this.canvas.requestPointerLock(); } catch {}
  }

  releasePointerLock() {
    try { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); } catch {}
  }

  startGame() {
    const keys = ["easy", "normal", "hard"];
    this.difficultyIndex = keys.indexOf(this.difficultyKey);
    this.state = "playing";
    this.resetGame();
    this.requestPointerLock();
  }

  resetGame() {
    // this.hideNameEntry();
    this.releasePointerLock();
    this.state = "playing";
    this.requestPointerLock();
    this.enemies = [];
    this.lastEnemyRespawned = 0;
    this.level = 1;
    this.levelUpAnim = null;
    this.scorePopups = [];
    this.powerUps = [];
    this.enemyBullets = [];
    this.mouseX = null;
    this.bossThisLevel = false;
    this.bossSpawned = false;
    this.miniBossThisLevel = false;
    this.miniBossSpawned = false;
    this.nextFormationTime = Date.now() + 8000;
    this.grazeCooldown = 0;
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.comboMilestone = 0;
    this.shootingStars = [];
    this.achievements.clearNew();
    // this.leaderboardDirty = true;
    this.player.reset(this.difficulty.lives);
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.releasePointerLock();
    } else if (this.state === "paused") {
      this.state = "playing";
      this.requestPointerLock();
    }
  }

  toggleMute() {
    this.soundManager.toggleMute();
  }

  spawnEnemyBullet(x: number, y: number, vx: number = 0, vy: number = 3) {
    this.enemyBullets.push({ x, y, vx, vy, size: 6, isDestroyed: false });
  }

  bombPowerUp() {
    for (const enemy of this.enemies) {
      if (enemy.isDestroyed) continue;
      if (enemy.type === "boss" || enemy.type === "miniBoss") {
        // Bosses shrug off bombs (but still take a flash hit for feedback).
        this.particleSystem.emit(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color1, 10);
        enemy.hitFlashTimer = 6;
      } else {
        enemy.destroy();
        this.particleSystem.explosion(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color1, 1);
      }
    }
    this.enemyBullets = [];
    this.particleSystem.emitShockwave(this.player.x, this.player.y, "#ff9100", Math.max(this.canvas.width, this.canvas.height), 6);
    this.shake(14, 20);
    this.soundManager.bomb();
  }

  update() {
    this.canvas.style.cursor = this.state === "playing" ? "none" : "default";

    if (this.state === "menu") {
      this.updateStars();
      this.updateAmbient();
      this.particleSystem.update();
      return;
    }

    if (this.state === "paused") {
      this.particleSystem.update();
      return;
    }

    if (this.state === "playing") {
      this.player.update();
      this.handleEnemiesUpdate();
      this.respawnEnemies();
      this.assignHomingTargets();
      this.handleCollisions();
      this.checkPowerUpCollection();
      this.handleMagnetEffect();
      this.checkLevelUp();
      this.checkWinCondition();
      this.updateEffects();
      this.updateEnemyBullets();
      this.updatePowerUps();
      this.checkGraze();
      this.updateStars();
      this.updateAmbient();
      this.updateShake();
      this.particleSystem.update();
      for (const w of this.spawnWarnings) w.timer--;
      this.spawnWarnings = this.spawnWarnings.filter(w => w.timer > 0);
    }

    if (this.state === "gameover" || this.state === "won") {
      this.updateStars();
      this.updateAmbient();
      this.particleSystem.update();
    }
  }

  updateShake() {
    if (this.shakeTime > 0) {
      this.shakeTime--;
      const decay = this.shakeTime > 0 ? 1 : 0;
      const amt = this.shakeMag * decay;
      this.shakeX = (Math.random() - 0.5) * amt * 2;
      this.shakeY = (Math.random() - 0.5) * amt * 2;
      if (this.shakeTime === 0) this.shakeMag = 0;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  updateAmbient() {
    for (const n of this.nebulae) {
      n.x += n.dx;
      n.y += n.dy;
      if (n.y - n.r > this.canvas.height) { n.y = -n.r; n.x = Math.random() * this.canvas.width; }
      if (n.x - n.r > this.canvas.width) n.x = -n.r;
      if (n.x + n.r < 0) n.x = this.canvas.width + n.r;
    }

    if (Math.random() < 0.012 && this.shootingStars.length < 3) {
      const fromLeft = Math.random() < 0.5;
      const speed = 9 + Math.random() * 7;
      this.shootingStars.push({
        x: fromLeft ? -40 : this.canvas.width + 40,
        y: Math.random() * this.canvas.height * 0.5,
        vx: (fromLeft ? 1 : -1) * speed,
        vy: speed * (0.3 + Math.random() * 0.3),
        len: 60 + Math.random() * 60,
        life: 60,
        maxLife: 60,
      });
    }
    for (const s of this.shootingStars) {
      s.x += s.vx;
      s.y += s.vy;
      s.life--;
    }
    this.shootingStars = this.shootingStars.filter(s => s.life > 0 && s.y < this.canvas.height + 60);
  }

  updateStars() {
    for (const layer of this.starLayers) {
      for (const star of layer) {
        star.y += star.speed;
        if (star.y > this.canvas.height) {
          star.y = -2;
          star.x = Math.random() * this.canvas.width;
        }
      }
    }
  }

  assignHomingTargets() {
    if (!this.player.homingMissile) return;
    for (const bullet of this.player.bullets) {
      if (bullet.isHoming && !bullet.homingTarget) {
        let closest: Enemy | null = null;
        let closestDist = Infinity;
        for (const enemy of this.enemies) {
          if (enemy.isDestroyed) continue;
          const dx = enemy.x + enemy.size / 2 - bullet.x;
          const dy = enemy.y + enemy.size / 2 - bullet.y;
          const d = dx * dx + dy * dy;
          if (d < closestDist) {
            closestDist = d;
            closest = enemy;
          }
        }
        if (closest) bullet.homingTarget = closest;
      }
    }
  }

  checkGraze() {
    if (this.grazeCooldown > 0) {
      this.grazeCooldown--;
      return;
    }
    const grazes = CollisionCheck.checkGraze(this.player, this.enemyBullets);
    if (grazes > 0) {
      this.player.grazeTotal += grazes;
      this.grazeCooldown = 5;
      this.scorePopups.push({
        x: this.player.x,
        y: this.player.y - 30,
        text: "GRAZE!",
        timer: 400,
        yOffset: 0,
        color: "#00bcd4",
        startTime: Date.now(),
      });
      this.player.score += grazes * 100;
    }
  }

  achStats(extra: Partial<AchievementStats> = {}): AchievementStats {
    return {
      score: this.player.score,
      level: this.level,
      comboCount: this.player.comboCount,
      perfectLevel: this.player.untouched,
      grazeTotal: this.player.grazeTotal,
      ...extra,
    };
  }

  spawnSplitterChildren(x: number, y: number) {
    for (let i = 0; i < 2; i++) {
      const e = new Enemy(this, this.level, "scout", this.difficulty.speedMult);
      e.x = Math.max(0, Math.min(this.canvas.width - e.size, x - e.size / 2 + (i === 0 ? -24 : 24)));
      e.y = y - e.size / 2;
      e.startX = e.x;
      this.enemies.push(e);
    }
  }

  checkComboMilestone() {
    const c = this.player.comboCount;
    const milestones = [5, 10, 15, 20, 30, 50];
    for (const m of milestones) {
      if (c >= m && this.comboMilestone < m) {
        this.comboMilestone = m;
        this.scorePopups.push({
          x: this.canvas.width / 2,
          y: this.canvas.height * 0.38,
          text: `${m}x COMBO!`,
          timer: 1000,
          yOffset: 0,
          color: "#ffea00",
          startTime: Date.now(),
        });
        this.soundManager.powerUp();
        break;
      }
    }
  }

  handleCollisions() {
    CollisionCheck.checkBulletEnemy(this.player, this.enemies, (info) => {
      const pts = this.player.addScore(info.points);
      const color = info.type === "boss" ? "#b388ff"
        : info.type === "miniBoss" ? "#ffab00"
        : info.type === "splitter" ? "#69f0ae"
        : info.type === "kamikaze" ? "#ff5252"
        : "#fff176";
      this.scorePopups.push({ x: info.x, y: info.y, text: `+${pts}`, timer: 800, yOffset: 0, color, startTime: Date.now() });

      if (info.isBoss) {
        this.particleSystem.explosion(info.x, info.y, color, info.type === "boss" ? 2.6 : 1.9);
        this.particleSystem.emitShockwave(info.x, info.y, "#ffffff", info.type === "boss" ? 180 : 130, 4);
        this.particleSystem.emit(info.x - 30, info.y, "#ff1744", 30);
        this.particleSystem.emit(info.x + 30, info.y, "#ff9100", 25);
        this.particleSystem.emit(info.x, info.y - 20, "#ffea00", 20);
        this.shake(info.type === "boss" ? 18 : 11, info.type === "boss" ? 28 : 18);
      } else {
        this.particleSystem.explosion(info.x, info.y, color, 1);
        this.shake(2, 4);
      }
      this.soundManager.explode();

      if (info.type === "splitter") this.spawnSplitterChildren(info.x, info.y);

      this.checkComboMilestone();

      if (!info.isBoss && Math.random() < 0.16) {
        const allTypes: PowerUpType[] = ["spread", "speed", "shield", "bomb", "piercing", "homing", "magnet", "drone", "rapidFire"];
        if (this.player.lives < (this.difficulty.lives + 2) || Math.random() < 0.3) {
          allTypes.push("extraLife");
        }
        this.powerUps.push(new PowerUp(info.x, info.y, allTypes[Math.floor(Math.random() * allTypes.length)]));
      }

      if (info.type === "boss") {
        this.bossSpawned = false;
        this.achievements.check(this.achStats({ bossKilled: true }));
      } else if (info.type === "miniBoss") {
        this.miniBossSpawned = false;
        this.achievements.check(this.achStats({ miniBossKilled: true }));
      } else {
        this.achievements.check(this.achStats());
      }
    });

    if (!this.player.isInvulnerable) {
      for (const enemy of this.enemies) {
        if (enemy.isDestroyed) continue;
        if (CollisionCheck.rectsIntersect(
          { x: this.player.x - this.player.SIZE / 2, y: this.player.y - this.player.SIZE / 2, width: this.player.SIZE, height: this.player.SIZE },
          { x: enemy.x, y: enemy.y, width: enemy.size, height: enemy.size }
        )) {
          enemy.destroy();
          this.particleSystem.emit(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color1, 15);
          this.playerHit();
          if (enemy.isDestroyed && (enemy.type === "boss" || enemy.type === "miniBoss")) {
            this.bossSpawned = false;
            this.miniBossSpawned = false;
          }
          break;
        }
      }
    }

    if (CollisionCheck.checkEnemyBulletPlayer(this.player, this.enemyBullets)) {
      this.playerHit();
    }
  }

  checkPowerUpCollection() {
    const collected = CollisionCheck.checkPlayerPowerUp(this.player, this.powerUps);
    if (collected) {
      this.player.activatePowerUp(collected as PowerUpType);
      this.particleSystem.emitShockwave(this.player.x, this.player.y, "#ffffff", 40, 2);
      if (collected === "drone") this.achievements.unlock("drone_pilot");
    }
  }

  handleMagnetEffect() {
    if (!this.player.magnet) return;
    const magnetRange = 200;
    for (const pu of this.powerUps) {
      if (pu.collected) continue;
      const dx = this.player.x - pu.x;
      const dy = this.player.y - pu.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < magnetRange && dist > 0) {
        const force = 5 * (1 - dist / magnetRange);
        pu.x += (dx / dist) * force;
        pu.y += (dy / dist) * force;
      }
    }
  }

  playerHit() {
    // Grace period after a hit: ignore any further damage while invulnerable.
    // This also prevents losing several lives in a single frame (e.g. when a
    // whole formation flies off the bottom of the screen at once), which felt
    // like "dying without being touched".
    if (this.player.isInvulnerable) return;

    this.player.untouched = false;
    this.player.hitFlashTimer = 8;
    this.particleSystem.emit(this.player.x, this.player.y, "#4dd0e1", 20);
    this.shake(8, 14);

    if (this.player.hasShield) {
      this.player.hasShield = false;
      this.particleSystem.emitShockwave(this.player.x, this.player.y, "#448aff", 70, 3);
      this.particleSystem.emit(this.player.x, this.player.y, "#448aff", 14);
      this.soundManager.hit();
      return;
    }

    this.player.lives--;
    this.soundManager.hit();
    this.particleSystem.explosion(this.player.x, this.player.y, "#4dd0e1", 1.4);
    if (this.player.lives <= 0) {
      this.shake(22, 32);
      this.particleSystem.explosion(this.player.x, this.player.y, "#ff5252", 2.2);
      this.state = "gameover";
      this.releasePointerLock();
      this.soundManager.gameOver();
      HighScore.save(this.player.score);
      // this.showNameEntry();
    } else {
      this.player.isInvulnerable = true;
      this.player.invulnerableTimer = Date.now();
    }
  }

  checkLevelUp() {
    const newLevel = Math.floor(this.player.score / 1500) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      const bonus = Math.min(this.level * 200, 2000);
      this.player.score += bonus;
      this.scorePopups.push({
        x: this.canvas.width / 2,
        y: this.canvas.height / 2 - 40,
        text: `+${bonus} BONUS`,
        timer: 1000,
        yOffset: 0,
        color: "#00e676",
        startTime: Date.now(),
      });
      this.levelUpAnim = { level: this.level, timer: 1500, stageName: this.getStageTheme().name };
      this.soundManager.levelUp();
      this.achievements.check(this.achStats());
      this.player.untouched = true;
      this.bossThisLevel = this.level % 5 === 0;
      this.bossSpawned = false;
      this.miniBossThisLevel = !this.bossThisLevel && (this.level % 3 === 2);
      this.miniBossSpawned = false;
      this.nextFormationTime = Date.now() + 5000;
    }
  }

  checkWinCondition() {
    if (this.player.score >= this.WIN_SCORE) {
      this.state = "won";
      this.releasePointerLock();
      this.soundManager.gameOver();
      this.achievements.check(this.achStats());
      this.achievements.unlock("win");
      HighScore.save(this.player.score);
      // this.showNameEntry();
    }
  }

  updateEffects() {
    if (this.player.comboCount === 0) this.comboMilestone = 0;
    for (const p of this.scorePopups) {
      p.yOffset += 1.5;
      p.timer -= 16;
    }
    this.scorePopups = this.scorePopups.filter((p) => p.timer > 0);

    if (this.levelUpAnim) {
      this.levelUpAnim.timer -= 16;
      if (this.levelUpAnim.timer <= 0) this.levelUpAnim = null;
    }
  }

  updateEnemyBullets() {
    for (const b of this.enemyBullets) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.y > this.canvas.height || b.y < -20 || b.x < -20 || b.x > this.canvas.width + 20) b.isDestroyed = true;
    }
    this.enemyBullets = this.enemyBullets.filter((b) => !b.isDestroyed);
  }

  updatePowerUps() {
    for (const pu of this.powerUps) pu.update();
    this.powerUps = this.powerUps.filter((p) => !p.collected && p.y < this.canvas.height + 30);
  }

  spawnFormation() {
    const cx = this.canvas.width / 2;
    const formationTypes = ["v", "line", "pincer"];
    const fType = formationTypes[Math.floor(Math.random() * formationTypes.length)];
    const count = 3 + Math.floor(this.level / 3);
    const enemyType = this.getEnemyTypeForFormation();

    const spawnX = (index: number, total: number, offset: number): number => {
      return cx + (index - (total - 1) / 2) * offset;
    };

    if (fType === "line") {
      for (let i = 0; i < count; i++) {
        const e = new Enemy(this, this.level, enemyType, this.difficulty.speedMult);
        e.x = spawnX(i, count, 50);
        e.y = -e.size - i * 50;
        this.enemies.push(e);
      }
    } else if (fType === "v") {
      for (let i = 0; i < count; i++) {
        const e = new Enemy(this, this.level, enemyType, this.difficulty.speedMult);
        const spread = 40;
        e.x = cx - (count - 1 - i) * spread / 2 + i * spread / 2;
        e.y = -e.size - i * 60;
        this.enemies.push(e);
      }
    } else if (fType === "pincer") {
      for (let i = 0; i < count; i++) {
        const eL = new Enemy(this, this.level, enemyType, this.difficulty.speedMult);
        eL.x = 20 - i * 10;
        eL.y = -eL.size - i * 60;
        this.enemies.push(eL);

        const eR = new Enemy(this, this.level, enemyType, this.difficulty.speedMult);
        eR.x = this.canvas.width - 20 - eR.size + i * 10;
        eR.y = -eR.size - i * 60;
        this.enemies.push(eR);
      }
    }
    this.nextFormationTime = Date.now() + 10000 + Math.random() * 5000 - this.level * 300;
  }

  getEnemyTypeForFormation(): EnemyType {
    const r = Math.random();
    if (this.level <= 2) return r < 0.7 ? "normal" : "scout";
    if (this.level <= 4) return r < 0.5 ? "normal" : r < 0.8 ? "scout" : "zigzag";
    if (this.level <= 7) return r < 0.3 ? "normal" : r < 0.5 ? "scout" : r < 0.7 ? "zigzag" : r < 0.85 ? "shooter" : "kamikaze";
    return r < 0.25 ? "normal" : r < 0.45 ? "scout" : r < 0.6 ? "zigzag" : r < 0.75 ? "kamikaze" : "shooter";
  }

  draw() {
    this.drawScreen();
  }

  drawScreen() {
    this.drawBackground();

    // Rebuilt every frame by the overlays / HUD below.
    this.actionButtons = [];

    if (this.state === "menu") {
      if (this.menuScreen === "main") { this.drawMainMenu(); return; }
      // if (this.menuScreen === "settings") { this.drawSettings(); return; } // settings disabled
    }
    // if (this.state === "leaderboard") { this.drawLeaderboardScreen(); return; }

    const shaking = this.shakeX !== 0 || this.shakeY !== 0;
    if (shaking) {
      this.ctx.save();
      this.ctx.translate(this.shakeX, this.shakeY);
    }

    this.player.draw();
    this.enemies.forEach((e) => e.draw());
    this.drawEnemyBullets();
    this.drawPowerUps();
    for (const w of this.spawnWarnings) {
      const alpha = w.timer / 15;
      this.ctx.fillStyle = `rgba(255, 50, 50, ${alpha * 0.6})`;
      this.ctx.beginPath();
      this.ctx.moveTo(w.x, 6);
      this.ctx.lineTo(w.x - 5, 0);
      this.ctx.lineTo(w.x + 5, 0);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.particleSystem.draw(this.ctx);
    this.drawScorePopups();

    if (shaking) this.ctx.restore();

    if (this.player.lives === 1 && this.state === "playing") {
      const pulse = 0.3 + 0.15 * Math.sin(Date.now() * 0.005);
      const grad = this.ctx.createRadialGradient(
        this.canvas.width / 2, this.canvas.height / 2, 0,
        this.canvas.width / 2, this.canvas.height / 2, Math.max(this.canvas.width, this.canvas.height) * 0.7
      );
      grad.addColorStop(0, "transparent");
      grad.addColorStop(0.6, "transparent");
      grad.addColorStop(0.85, `rgba(255, 0, 0, ${pulse * 0.3})`);
      grad.addColorStop(1, `rgba(255, 0, 0, ${pulse * 0.6})`);
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.scoreBox.draw(this.ctx, {
      score: this.player.score,
      lives: this.player.lives,
      level: this.level,
      levelProgress: (this.player.score % 1500) / 1500,
      winScore: this.WIN_SCORE,
      comboCount: this.player.comboCount,
      activePowerUp: this.getActivePowerUp(),
      muted: this.soundManager.muted,
      highScore: HighScore.load(),
      grazeTotal: this.player.grazeTotal,
      autoFire: this.autoFire,
    });

    if (this.state === "playing") {
      this.drawBossBar();
      this.drawInGamePauseButton();
    }

    if (this.levelUpAnim) this.drawLevelUp();

    if (this.state === "paused") this.drawPauseOverlay();
    else if (this.state === "gameover") this.drawGameOver();
    else if (this.state === "won") this.drawWin();
  }

  // Draws a rounded button and registers its bounds for tap/click handling.
  drawButton(id: string, label: string, x: number, y: number, w: number, h: number, accent: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = accent + "55";
    ctx.shadowBlur = 12;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, accent + "26");
    grad.addColorStop(1, accent + "12");
    ctx.fillStyle = grad;
    this.roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = accent + "aa";
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.restore();
    this.actionButtons.push({ id, x, y, w, h });
  }

  // Two side-by-side buttons centred horizontally at vertical position `y`.
  drawButtonPair(
    y: number,
    left: { id: string; label: string; accent: string },
    right: { id: string; label: string; accent: string }
  ) {
    const cx = this.canvas.width / 2;
    const gap = 16;
    const maxRow = Math.min(this.canvas.width - 40, 380);
    const bw = (maxRow - gap) / 2;
    const bh = 48;
    const bx = cx - (bw * 2 + gap) / 2;
    this.drawButton(left.id, left.label, bx, y, bw, bh, left.accent);
    this.drawButton(right.id, right.label, bx + bw + gap, y, bw, bh, right.accent);
  }

  // Small pause button shown top-right during play (mainly for touch).
  drawInGamePauseButton() {
    const ctx = this.ctx;
    const size = 36;
    const x = this.canvas.width - size - 12;
    const y = 64;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    this.roundRect(ctx, x, y, size, size, 9);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, size, size, 9);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    const bw = 4, bh = size * 0.44;
    ctx.fillRect(x + size * 0.36 - bw / 2, y + (size - bh) / 2, bw, bh);
    ctx.fillRect(x + size * 0.64 - bw / 2, y + (size - bh) / 2, bw, bh);
    ctx.restore();
    this.actionButtons.push({ id: "pause", x, y, w: size, h: size });
  }

  getActivePowerUp(): { type: string; remaining: number } | null {
    if (this.player.hasShield) return { type: "shield", remaining: 99999 };
    if (this.player.spreadShot) {
      const rem = this.player.POWERUP_DURATION - (Date.now() - this.player.spreadTimer);
      return { type: "spread", remaining: Math.max(0, rem) };
    }
    if (this.player.speedBoost) {
      const rem = this.player.POWERUP_DURATION - (Date.now() - this.player.speedTimer);
      return { type: "speed", remaining: Math.max(0, rem) };
    }
    if (this.player.piercingShot) {
      const rem = this.player.POWERUP_DURATION - (Date.now() - this.player.piercingTimer);
      return { type: "piercing", remaining: Math.max(0, rem) };
    }
    if (this.player.homingMissile) {
      const rem = this.player.POWERUP_DURATION - (Date.now() - this.player.homingTimer);
      return { type: "homing", remaining: Math.max(0, rem) };
    }
    if (this.player.magnet) {
      const rem = this.player.POWERUP_DURATION - (Date.now() - this.player.magnetTimer);
      return { type: "magnet", remaining: Math.max(0, rem) };
    }
    if (this.player.rapidFire) {
      const rem = this.player.POWERUP_DURATION - (Date.now() - this.player.rapidTimer);
      return { type: "rapidFire", remaining: Math.max(0, rem) };
    }
    if (this.player.drone) {
      const rem = this.player.DRONE_DURATION - (Date.now() - this.player.droneTimer);
      return { type: "drone", remaining: Math.max(0, rem) };
    }
    return null;
  }

  drawBossBar() {
    const boss = this.enemies.find((e) => (e.type === "boss" || e.type === "miniBoss") && !e.isDestroyed);
    if (!boss) return;
    const ctx = this.ctx;
    const isBoss = boss.type === "boss";
    const barW = Math.min(this.canvas.width * 0.6, 560);
    const barH = 14;
    const x = (this.canvas.width - barW) / 2;
    const y = 72;
    const accent = isBoss ? "#b388ff" : "#ffab00";
    const ratio = Math.max(0, boss.displayHealth / boss.maxHealth);

    ctx.save();
    ctx.fillStyle = accent;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillText(isBoss ? "\u2620 BOSS" : "\u25C6 MINI-BOSS", this.canvas.width / 2, y - 12);
    ctx.shadowBlur = 0;

    this.roundRect(ctx, x, y, barW, barH, 7);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
    ctx.strokeStyle = accent + "66";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (ratio > 0) {
      ctx.save();
      this.roundRect(ctx, x + 1, y + 1, Math.max((barW - 2) * ratio, 6), barH - 2, 6);
      const g = ctx.createLinearGradient(x, 0, x + barW, 0);
      g.addColorStop(0, accent);
      g.addColorStop(1, "#ff1744");
      ctx.fillStyle = g;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  drawEnemyBullets() {
    const ctx = this.ctx;
    for (const b of this.enemyBullets) {
      if (b.isDestroyed) continue;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.size * 2.5);
      g.addColorStop(0, "rgba(255, 50, 50, 0.3)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff5252";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff8a80";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPowerUps() {
    for (const pu of this.powerUps) {
      if (!pu.collected) pu.draw(this.ctx);
    }
  }

  drawScorePopups() {
    const ctx = this.ctx;
    for (const p of this.scorePopups) {
      ctx.globalAlpha = p.timer / 800;
      const elapsed = Date.now() - p.startTime;
      const scale = Math.min(1, 0.3 + elapsed / 150 * 0.7);
      ctx.fillStyle = p.color;
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(p.x, p.y - p.yOffset);
      ctx.scale(scale, scale);
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawLevelUp() {
    const ctx = this.ctx;
    const progress = this.levelUpAnim!.timer / 1500;
    let alpha: number;
    if (progress > 0.8) alpha = (1 - progress) / 0.2;
    else if (progress < 0.2) alpha = progress / 0.2;
    else alpha = 1;
    const scale = 1 + 0.25 * (1 - progress);
    const theme = this.getStageTheme();

    ctx.save();
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2 - 80);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = theme.accentColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = theme.accentColor;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`LEVEL ${this.levelUpAnim!.level}`, 0, -16);
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.accentColor + "99";
    ctx.font = "bold 16px monospace";
    ctx.fillText(this.levelUpAnim!.stageName.toUpperCase(), 0, 34);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawBackground() {
    const ctx = this.ctx;
    const theme = this.state === "playing" ? this.getStageTheme() : STAGE_THEMES[0];
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === "playing" && this.level > 5) {
      const hex = Math.floor(Math.min(1, (this.level - 5) / 10) * 0.05 * 255).toString(16).padStart(2, "0");
      ctx.fillStyle = theme.accentColor + hex;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const n of this.nebulae) {
      const color = n.tone < 0.5 ? theme.accentColor : theme.nearColor;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, color + "12");
      g.addColorStop(0.5, color + "08");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const now = Date.now() * 0.001;
    for (let li = 0; li < this.starLayers.length; li++) {
      const speed = 2 + li * 1.5;
      for (const star of this.starLayers[li]) {
        const twinkle = 0.7 + 0.3 * Math.sin(now * speed + star.x * 0.1);
        ctx.globalAlpha = star.alpha * twinkle;
        ctx.fillStyle = li === 2 ? theme.nearColor : theme.starColor;
        if (star.size <= 1.5) {
          ctx.fillRect(star.x, star.y, 1, 1);
        } else {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;

    if (this.shootingStars.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (const s of this.shootingStars) {
        const a = Math.min(1, s.life / s.maxLife) * Math.min(1, (s.maxLife - s.life) / 8);
        const mag = Math.hypot(s.vx, s.vy) || 1;
        const tx = s.x - (s.vx / mag) * s.len;
        const ty = s.y - (s.vy / mag) * s.len;
        const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
        g.addColorStop(1, "transparent");
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.state === "menu") {
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      ctx.fillStyle = "rgba(0, 150, 255, 0.015)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const g = ctx.createRadialGradient(cx, cy - 80, 0, cx, cy, 320);
      g.addColorStop(0, "rgba(80, 0, 180, 0.03)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  handleEnemiesUpdate() {
    for (const enemy of this.enemies) {
      enemy.update();
      if (enemy.y > this.canvas.height && !enemy.isDestroyed) {
        enemy.isDestroyed = true;
        if (this.state === "playing") this.playerHit();
      }
    }
    this.enemies = this.enemies.filter((e) => !e.isDestroyed);
  }

  getEnemyTypeForLevel(): EnemyType {
    if (this.bossThisLevel && !this.bossSpawned) {
      this.bossSpawned = true;
      return "boss";
    }
    if (this.miniBossThisLevel && !this.miniBossSpawned) {
      this.miniBossSpawned = true;
      return "miniBoss";
    }
    const r = Math.random();
    if (this.level <= 2) {
      if (r < 0.75) return "normal";
      return "scout";
    }
    if (this.level <= 4) {
      if (r < 0.5) return "normal";
      if (r < 0.75) return "scout";
      return "zigzag";
    }
    if (this.level <= 7) {
      if (r < 0.25) return "normal";
      if (r < 0.42) return "scout";
      if (r < 0.55) return "zigzag";
      if (r < 0.70) return "tank";
      if (r < 0.85) return "shooter";
      return "kamikaze";
    }
    if (r < 0.18) return "normal";
    if (r < 0.34) return "scout";
    if (r < 0.46) return "zigzag";
    if (r < 0.60) return "tank";
    if (r < 0.73) return "shooter";
    if (r < 0.87) return "kamikaze";
    return "splitter";
  }

  respawnEnemies() {
    const now = Date.now();

    if (now >= this.nextFormationTime && !this.bossThisLevel && !this.miniBossThisLevel) {
      this.spawnFormation();
      return;
    }

    const baseInterval = Math.max(400, 2000 - (this.level - 1) * 250);
    const interval = baseInterval * this.difficulty.spawnMult;
    if (now - this.lastEnemyRespawned >= interval) {
      this.lastEnemyRespawned = now;
      const type = this.getEnemyTypeForLevel();
      const enemy = new Enemy(this, this.level, type, this.difficulty.speedMult);
      this.spawnWarnings.push({ x: enemy.x, timer: 15 });
      this.enemies.push(enemy);
    }
  }

  drawMainMenu() {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const t = Date.now() * 0.001;

    // Title scales down on narrow screens so "SPACE BLASTER" always fits.
    const titleSize = Math.min(54, (this.canvas.width - 40) / 9);
    const starOff = Math.min(188, cx - 26);
    const decoOuter = Math.min(170, cx - 34);
    const decoInner = Math.min(50, decoOuter - 40);

    ctx.save();
    ctx.translate(cx, 90);
    const titleScale = 0.96 + 0.04 * Math.sin(t * 1.8);
    ctx.scale(titleScale, titleScale);
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 50;
    ctx.fillStyle = "#00e5ff";
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPACE  BLASTER", 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.fillStyle = "rgba(0, 229, 255, 0.06)";
    ctx.font = `bold ${Math.min(80, titleSize * 1.5)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 1.5);
    ctx.fillText("\u2606", cx - starOff, 91);
    ctx.fillText("\u2606", cx + starOff, 91);
    ctx.globalAlpha = 1;

    const decoY = 130;
    ctx.strokeStyle = `rgba(0, 200, 255, ${0.08 + 0.04 * Math.sin(t * 1.2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - decoOuter, decoY);
    ctx.lineTo(cx - decoInner, decoY);
    ctx.stroke();
    ctx.fillStyle = `rgba(0, 200, 255, ${0.15 + 0.08 * Math.sin(t * 1.5)})`;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u2605 \u00B7 \u2605 \u00B7 \u2605", cx, decoY);
    ctx.beginPath();
    ctx.moveTo(cx + decoInner, decoY);
    ctx.lineTo(cx + decoOuter, decoY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Defend the galaxy. Survive the onslaught.", cx, 158);

    const diffKeys = ["easy", "normal", "hard"];
    const diffLabels = ["EASY", "NORMAL", "HARD"];
    const diffColors = ["#76ff03", "#00e5ff", "#ff1744"];
    const diffBgs = ["rgba(118, 255, 3, 0.08)", "rgba(0, 229, 255, 0.08)", "rgba(255, 23, 68, 0.08)"];
    const diffDescs = ["8 \u2764 slow", "5 \u2764 balanced", "3 \u2764 fast"];

    // Responsive layout: fit the three cards (and the buttons) to the screen
    // width so everything stays on-screen and tappable on phones.
    const availW = Math.min(this.canvas.width - 24, 540);
    const cardH = 54;
    const cardGap = availW < 360 ? 8 : 18;
    const cardW = Math.min(160, (availW - 2 * cardGap) / 3);
    const cardsTotalW = 3 * cardW + 2 * cardGap;
    const cardsStartX = cx - cardsTotalW / 2;
    const cardsY = 200;

    this.menuBtnBounds = [];
    this.diffCardBounds = [];

    for (let i = 0; i < 3; i++) {
      const x = cardsStartX + i * (cardW + cardGap);
      const selected = this.difficultyKey === diffKeys[i];
      const color = diffColors[i];

      ctx.save();
      if (selected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
      }

      this.roundRect(ctx, x, cardsY, cardW, cardH, 8);
      ctx.fillStyle = selected ? diffBgs[i] : "rgba(255, 255, 255, 0.02)";
      ctx.fill();
      ctx.strokeStyle = selected ? color : "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.fillStyle = selected ? color : "rgba(255, 255, 255, 0.35)";
      ctx.font = selected ? "bold 15px monospace" : "13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(diffLabels[i], x + cardW / 2, cardsY + cardH / 2 - 8);

      ctx.fillStyle = selected ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.25)";
      ctx.font = "10px monospace";
      ctx.fillText(diffDescs[i], x + cardW / 2, cardsY + cardH / 2 + 14);

      this.diffCardBounds.push({ x, y: cardsY, w: cardW, h: cardH });
    }

    const hintY = cardsY + cardH + 10;
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Tap a mode  \u00b7  1 / 2 / 3 or \u2190 \u2192 to change", cx, hintY);

    const btnW = Math.min(260, availW);
    const btnH = 50;
    const btnGap = 14;
    const buttonsStartY = cardsY + cardH + 38;

    for (let i = 0; i < MAIN_MENU_ITEMS.length; i++) {
      const y = buttonsStartY + i * (btnH + btnGap);
      const x = cx - btnW / 2;
      const selected = i === this.menuSelection;

      ctx.save();
      if (selected) {
        ctx.shadowColor = "rgba(0, 200, 255, 0.2)";
        ctx.shadowBlur = 12;
      }
      const grad = ctx.createLinearGradient(x, y, x, y + btnH);
      grad.addColorStop(0, selected ? "rgba(0, 200, 255, 0.10)" : "rgba(255, 255, 255, 0.03)");
      grad.addColorStop(1, selected ? "rgba(0, 200, 255, 0.18)" : "rgba(255, 255, 255, 0.06)");
      ctx.fillStyle = grad;
      ctx.strokeStyle = selected
        ? "rgba(0, 200, 255, 0.5)"
        : "rgba(255, 255, 255, 0.10)";
      ctx.lineWidth = selected ? 1.5 : 1;
      this.roundRect(ctx, x, y, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      const icon = i === 0 ? "\u25B6" : i === 1 ? "\u2699" : "\u2605";
      ctx.fillStyle = selected ? "#00e5ff" : "rgba(255, 255, 255, 0.35)";
      ctx.font = "13px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, x + 18, y + btnH / 2 + 0.5);

      ctx.fillStyle = selected ? "#ffffff" : "rgba(255, 255, 255, 0.55)";
      ctx.font = selected ? "bold 14px monospace" : "13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(MAIN_MENU_ITEMS[i], cx, y + btnH / 2);

      this.menuBtnBounds.push({ x, y, w: btnW, h: btnH });
    }

    // this.leaderboardBtnBounds = this.menuBtnBounds[2]; // leaderboard disabled

    const infoY = buttonsStartY + MAIN_MENU_ITEMS.length * (btnH + btnGap) + 22;
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Drag to move  ·  A/D or arrows  ·  auto-fire on", cx, infoY);

    const hs = HighScore.load();
    const ac = this.achievements.getUnlockedCount();
    if (hs > 0 || ac > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      const boxW = 300;
      this.roundRect(ctx, cx - boxW / 2, infoY + 14, boxW, 36, 6);
      ctx.fill();

      if (hs > 0) {
        ctx.fillStyle = "#ffea00";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`\u2605 HIGH SCORE: ${hs}`, cx - boxW / 2 + 16, infoY + 32);
      }

      if (ac > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "11px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`ACHIEVEMENTS: ${ac}/${this.achievements.getTotalCount()}`, cx + boxW / 2 - 16, infoY + 32);
      }
    }
  }

  /* Settings screen removed from the menu (mute is still available in-game via "M").
  drawSettings() {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const t = Date.now() * 0.001;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(cx, 80);
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 25;
    ctx.fillStyle = "#00e5ff";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SETTINGS", 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.strokeStyle = `rgba(0, 200, 255, ${0.08 + 0.04 * Math.sin(t * 1.3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 140, 108);
    ctx.lineTo(cx + 140, 108);
    ctx.stroke();

    const panelW = 340;
    const panelH = 140;
    const panelX = cx - panelW / 2;
    const panelY = this.canvas.height / 2 - panelH / 2 - 10;

    ctx.save();
    ctx.shadowColor = "rgba(0, 200, 255, 0.08)";
    ctx.shadowBlur = 20;
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fillStyle = "rgba(10, 10, 30, 0.7)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 200, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    const items = [
      { label: "Sound", value: !this.soundManager.muted, onColor: "#76ff03", offColor: "rgba(255,255,255,0.25)" },
    ];

    const rowH = 56;

    for (let i = 0; i < items.length; i++) {
      const y = panelY + 28 + i * rowH;
      const selected = i === this.menuSelection;

      if (selected) {
        ctx.fillStyle = "rgba(0, 200, 255, 0.06)";
        this.roundRect(ctx, panelX + 12, y - rowH / 2 + 2, panelW - 24, rowH - 4, 8);
        ctx.fill();
      }

      ctx.fillStyle = selected ? "#ffffff" : "rgba(255, 255, 255, 0.5)";
      ctx.font = selected ? "bold 14px monospace" : "13px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(items[i].label, panelX + 28, y + 1);

      const toggleX = panelX + panelW - 28;
      const toggleW = 42;
      const toggleH = 22;
      const toggleY = y - toggleH / 2;
      const isOn = items[i].value;

      ctx.fillStyle = isOn ? "rgba(118, 255, 3, 0.15)" : "rgba(255, 255, 255, 0.06)";
      this.roundRect(ctx, toggleX - toggleW, toggleY, toggleW, toggleH, 11);
      ctx.fill();
      ctx.strokeStyle = isOn ? "rgba(118, 255, 3, 0.3)" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      this.roundRect(ctx, toggleX - toggleW, toggleY, toggleW, toggleH, 11);
      ctx.stroke();

      const knobX = isOn ? toggleX - toggleW + toggleH - 2 : toggleX - toggleW + 4;
      ctx.fillStyle = isOn ? "#76ff03" : "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(knobX + toggleH / 2 - 4, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    const backY = panelY + panelH + 20;
    const backW = 140;
    const backH = 38;
    this.backBtnBounds = { x: cx - backW / 2, y: backY, w: backW, h: backH };

    ctx.save();
    const backSelected = this.menuSelection === 2;
    ctx.shadowColor = backSelected ? "rgba(0, 200, 255, 0.15)" : "transparent";
    ctx.shadowBlur = 10;
    ctx.fillStyle = backSelected ? "rgba(0, 200, 255, 0.08)" : "rgba(255, 255, 255, 0.03)";
    ctx.strokeStyle = backSelected ? "rgba(0, 200, 255, 0.4)" : "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = backSelected ? 1.5 : 1;
    this.roundRect(ctx, this.backBtnBounds.x, this.backBtnBounds.y, backW, backH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.fillStyle = backSelected ? "#00e5ff" : "rgba(255, 255, 255, 0.45)";
    ctx.font = backSelected ? "bold 14px monospace" : "13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u2190  BACK", cx, backY + backH / 2);

    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("\u2191 \u2193 navigate  |  ENTER to toggle  |  ESC to go back", cx, backY + backH + 22);
  }
  */

  /* Leaderboard screen disabled for now (client-side only).
  drawLeaderboardScreen() {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const t = Date.now() * 0.001;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const nebula = ctx.createRadialGradient(cx, 120, 0, cx, 120, 400);
    nebula.addColorStop(0, "rgba(0, 150, 255, 0.04)");
    nebula.addColorStop(1, "transparent");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(cx, 75);
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#00e5ff";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LEADERBOARD", 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.strokeStyle = `rgba(0, 200, 255, ${0.1 + 0.05 * Math.sin(t * 1.2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 190, 103);
    ctx.lineTo(cx + 190, 103);
    ctx.stroke();

    if (this.leaderboard.length === 0) {
      ctx.save();
      ctx.translate(cx, this.canvas.height / 2);
      ctx.shadowColor = "rgba(0, 200, 255, 0.1)";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "rgba(0, 229, 255, 0.08)";
      this.roundRect(ctx, -160, -50, 320, 100, 12);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No scores yet. Be the first!", cx, this.canvas.height / 2 - 8);

      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "13px monospace";
        ctx.fillText("Press ESC to return", cx, this.canvas.height / 2 + 32);
      }
      return;
    }

    const startY = 130;
    const rowH = 44;
    const visibleCount = Math.min(this.leaderboard.length, Math.floor((this.canvas.height - startY - 80) / rowH));
    const topEntries = this.leaderboard.slice(0, visibleCount);

    const medals = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];

    for (let i = 0; i < topEntries.length; i++) {
      const entry = topEntries[i];
      const y = startY + i * rowH;

      if (i < 3) {
        const medalColors = ["rgba(255, 215, 0, 0.06)", "rgba(192, 192, 192, 0.05)", "rgba(205, 127, 50, 0.05)"];
        ctx.save();
        ctx.shadowColor = i === 0 ? "rgba(255, 215, 0, 0.08)" : "transparent";
        ctx.shadowBlur = i === 0 ? 8 : 0;
        this.roundRect(ctx, cx - 230, y - rowH / 2 + 3, 460, rowH - 6, 8);
        ctx.fillStyle = medalColors[i];
        ctx.fill();
        ctx.strokeStyle = i === 0 ? "rgba(255, 215, 0, 0.15)" : "transparent";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 210, y - rowH / 2);
        ctx.lineTo(cx + 210, y - rowH / 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(cx - 230 + 26, y);
      if (i < 3) {
        ctx.font = "20px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(medals[i], 0, 0);
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`#${i + 1}`, 0, 0);
      }
      ctx.restore();

      const nameX = cx - 175;
      ctx.fillStyle = i === 0 ? "#ffea00" : i === 1 ? "#e0e0e0" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.65)";
      ctx.font = i < 3 ? "bold 15px monospace" : "14px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(entry.nickname, nameX, y);

      ctx.fillStyle = i === 0 ? "#ffea00" : i === 1 ? "#e0e0e0" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.45)";
      ctx.font = i < 3 ? "bold 14px monospace" : "13px monospace";
      ctx.textAlign = "right";
      ctx.fillText(entry.score.toString(), cx + 230 - 26, y);
    }

    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Press ESC or BACKSPACE to return", cx, this.canvas.height - 35);
    }
  }
  */

  roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  drawPauseOverlay() {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(cx, cy - 60);
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    this.drawButtonPair(
      cy - 5,
      { id: "resume", label: "▶ RESUME", accent: "#00e5ff" },
      { id: "menu", label: "≡ QUIT", accent: "#ff5252" }
    );

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ESC to resume  ·  Q to quit", cx, cy + 74);
  }

  drawGameOver() {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.004);
    ctx.save();
    ctx.translate(cx, this.canvas.height / 2 - 100);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = "#ff1744";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#ff1744";
    ctx.font = "bold 54px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GAME OVER", 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    this.roundRect(ctx, cx - 200, this.canvas.height / 2 - 50, 400, 90, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`SCORE: ${this.player.score}`, cx, this.canvas.height / 2 - 22);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "16px monospace";
    ctx.fillText(`LEVEL: ${this.level}`, cx, this.canvas.height / 2 + 6);

    if (this.player.grazeTotal > 0) {
      ctx.fillStyle = "rgba(0, 188, 212, 0.5)";
      ctx.font = "12px monospace";
      ctx.fillText(`GRAZES: ${this.player.grazeTotal}`, cx, this.canvas.height / 2 + 30);
    }

    let bottomY = this.canvas.height / 2 + 48;
    if (this.player.grazeTotal > 0) bottomY += 18;

    const hs = HighScore.load();
    const isNew = this.player.score > 0 && this.player.score >= hs;
    if (isNew) {
      ctx.fillStyle = "#ffea00";
      ctx.font = "bold 17px monospace";
      ctx.fillText("NEW HIGH SCORE!", cx, bottomY);
      bottomY += 28;
    } else if (hs > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "14px monospace";
      ctx.fillText(`HIGH SCORE: ${hs}`, cx, bottomY);
      bottomY += 28;
    }

    const newAch = this.achievements.getNew();
    if (newAch.length > 0) {
      bottomY += 8;
      ctx.fillStyle = "rgba(118, 255, 3, 0.06)";
      this.roundRect(ctx, cx - 190, bottomY - 8, 380, 26 + newAch.length * 22, 8);
      ctx.fill();

      ctx.fillStyle = "#76ff03";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ACHIEVEMENTS UNLOCKED:", cx, bottomY + 6);
      newAch.forEach((a, i) => {
        ctx.fillStyle = "#76ff03";
        ctx.font = "12px monospace";
        ctx.fillText(`\u2605 ${a.name} \u2014 ${a.desc}`, cx, bottomY + 28 + i * 22);
      });
      bottomY += 24 + newAch.length * 22;
    }

    const restartY = this.canvas.height - 76;
    this.drawButtonPair(
      restartY,
      { id: "restart", label: "↻ RESTART", accent: "#00e5ff" },
      { id: "menu", label: "≡ MENU", accent: "#ff5252" }
    );

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ENTER to restart  ·  Q for menu", cx, restartY + 62);
  }

  drawWin() {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const t = Date.now() * 0.001;

    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const pulse = 0.92 + 0.08 * Math.sin(t * 2);
    ctx.save();
    ctx.translate(cx, this.canvas.height / 2 - 90);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = "#00e676";
    ctx.shadowBlur = 50;
    ctx.fillStyle = "#00e676";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("YOU WIN!", 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.fillStyle = "rgba(118, 255, 3, 0.06)";
    this.roundRect(ctx, cx - 200, this.canvas.height / 2 - 40, 400, 80, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(118, 255, 3, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`FINAL SCORE: ${this.player.score}`, cx, this.canvas.height / 2 - 14);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "15px monospace";
    ctx.fillText(`LEVEL: ${this.level}`, cx, this.canvas.height / 2 + 16);

    if (this.player.grazeTotal > 0) {
      ctx.fillStyle = "rgba(0, 188, 212, 0.5)";
      ctx.font = "12px monospace";
      ctx.fillText(`GRAZES: ${this.player.grazeTotal}`, cx, this.canvas.height / 2 + 38);
    }

    const btnY = this.canvas.height - 76;
    this.drawButtonPair(
      btnY,
      { id: "restart", label: "↻ PLAY AGAIN", accent: "#00e676" },
      { id: "menu", label: "≡ MENU", accent: "#ff5252" }
    );

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ENTER to restart  ·  Q for menu", cx, btnY + 62);
  }
}

export default Game;
