import type Game from "../game/game";

export type EnemyType = "normal" | "scout" | "tank" | "shooter" | "zigzag" | "boss" | "miniBoss" | "kamikaze" | "splitter";

const ENEMY_CONFIG: Record<EnemyType, { size: number; color1: string; color2: string; eyeColor: string }> = {
  normal: { size: 40, color1: "#ff6b6b", color2: "#c0392b", eyeColor: "#ffeb3b" },
  scout: { size: 24, color1: "#ce93d8", color2: "#7b1fa2", eyeColor: "#e1bee7" },
  tank: { size: 50, color1: "#e53935", color2: "#b71c1c", eyeColor: "#ff8a80" },
  shooter: { size: 40, color1: "#ff7043", color2: "#bf360c", eyeColor: "#ffcc02" },
  zigzag: { size: 36, color1: "#4fc3f7", color2: "#01579b", eyeColor: "#b3e5fc" },
  boss: { size: 80, color1: "#7c4dff", color2: "#311b92", eyeColor: "#ff1744" },
  miniBoss: { size: 55, color1: "#ffab00", color2: "#bf360c", eyeColor: "#ffd54f" },
  kamikaze: { size: 28, color1: "#ff1744", color2: "#7f0000", eyeColor: "#ffeb3b" },
  splitter: { size: 44, color1: "#69f0ae", color2: "#00695c", eyeColor: "#b9f6ca" },
};

class Enemy {
  game: Game;
  x: number;
  y: number;
  speed: number;
  type: EnemyType;
  size: number;
  health: number;
  maxHealth: number;
  displayHealth: number;
  points: number;
  isDestroyed: boolean = false;
  hitFlashTimer: number = 0;
  oscOffset: number;
  shootTimer: number = 0;
  color1: string;
  color2: string;
  eyeColor: string;
  startX: number;
  oscillateAmp: number;

  constructor(gameInstance: Game, level: number = 1, type?: EnemyType, speedMult: number = 1) {
    this.game = gameInstance;
    const cfg = ENEMY_CONFIG[type || "normal"];
    const lvl = type === "boss" ? Math.min(level, 10) : type === "miniBoss" ? Math.min(level, 8) : level;
    this.type = type || "normal";
    this.size = cfg.size;
    this.color1 = cfg.color1;
    this.color2 = cfg.color2;
    this.eyeColor = cfg.eyeColor;
    this.speed = this.getBaseSpeed(type, lvl) * speedMult;
    this.health = this.getMaxHealth(type, lvl);
    this.maxHealth = this.health;
    this.displayHealth = this.health;
    this.points = this.getPoints(type);
    this.x = Math.random() * (gameInstance.canvas.width - this.size);
    this.y = -this.size;
    this.startX = this.x;
    this.oscOffset = Math.random() * Math.PI * 2;
    this.oscillateAmp = type === "zigzag" ? 60 : type === "boss" || type === "miniBoss" ? 100 : 0;
  }

  private getBaseSpeed(type: EnemyType | undefined, level: number): number {
    switch (type) {
      case "scout": return 3 + level * 0.6;
      case "tank": return 1 + level * 0.3;
      case "boss": return 0.8 + level * 0.1;
      case "miniBoss": return 1 + level * 0.15;
      case "kamikaze": return 3.5 + level * 0.5;
      case "splitter": return 1.6 + level * 0.3;
      default: return 2 + (level - 1) * 0.5;
    }
  }

  private getMaxHealth(type: EnemyType | undefined, level: number): number {
    switch (type) {
      case "tank": return 2;
      // Bosses were a bit too tanky; reduced the per-level scaling so they die
      // faster. (level is capped at 10 for bosses by the constructor.)
      case "boss": return 4 + level;
      case "miniBoss": return 3 + Math.floor(level / 3);
      case "splitter": return 2;
      default: return 1;
    }
  }

  private getPoints(type: EnemyType | undefined): number {
    switch (type) {
      case "scout": return 200;
      case "tank": return 300;
      case "shooter": return 200;
      case "zigzag": return 200;
      case "boss": return 2000;
      case "miniBoss": return 800;
      case "kamikaze": return 250;
      case "splitter": return 350;
      default: return 100;
    }
  }

  takeDamage() {
    this.health--;
    this.hitFlashTimer = 6;
    if (this.health <= 0) this.isDestroyed = true;
  }

  update() {
    if (this.hitFlashTimer > 0) this.hitFlashTimer--;
    this.displayHealth += (this.health - this.displayHealth) * 0.15;
    if (Math.abs(this.displayHealth - this.health) < 0.01) this.displayHealth = this.health;
    if (this.oscillateAmp > 0) {
      this.x = this.startX + Math.sin(Date.now() * 0.002 + this.oscOffset) * this.oscillateAmp;
      this.x = Math.max(0, Math.min(this.game.canvas.width - this.size, this.x));
    }
    if (this.type === "kamikaze") {
      const targetX = this.game.player.x - this.size / 2;
      const diff = targetX - this.x;
      this.x += Math.sign(diff) * Math.min(Math.abs(diff), this.speed * 0.7);
      this.x = Math.max(0, Math.min(this.game.canvas.width - this.size, this.x));
    }
    this.y += this.speed;

    if (this.type === "shooter" || this.type === "boss" || this.type === "miniBoss") {
      this.shootTimer++;
      const interval = this.type === "boss" ? 40 : this.type === "miniBoss" ? 50 : 80;
      if (this.shootTimer >= interval) {
        this.shootTimer = 0;
        const bx = this.x + this.size / 2;
        const by = this.y + this.size;
        const player = this.game.player;
        if (this.type === "boss") {
          const pattern = Math.floor(Date.now() / 2000) % 3;
          if (pattern === 0) {
            const dx = player.x - bx;
            const dy = player.y - by;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = 4;
            this.game.spawnEnemyBullet(bx, by, dx / dist * speed, dy / dist * speed);
          } else if (pattern === 1) {
            for (let i = -1; i <= 1; i++) {
              const dx = player.x - bx + i * 40;
              const dy = player.y - by;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const speed = 3.5;
              this.game.spawnEnemyBullet(bx, by, dx / dist * speed, dy / dist * speed);
            }
          } else {
            const angle = Date.now() * 0.003;
            for (let i = 0; i < 4; i++) {
              const a = angle + i * Math.PI / 2;
              this.game.spawnEnemyBullet(bx, by, Math.cos(a) * 2.5, Math.sin(a) * 2.5);
            }
          }
        } else if (this.type === "miniBoss") {
          const dx = player.x - bx;
          const dy = player.y - by;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const speed = 3.5;
          if (Math.floor(Date.now() / 1500) % 2 === 0) {
            this.game.spawnEnemyBullet(bx, by, dx / dist * speed, dy / dist * speed);
          } else {
            for (let i = -1; i <= 1; i++) {
              const ddx = dx + i * 35;
              const d = Math.sqrt(ddx * ddx + dy * dy) || 1;
              this.game.spawnEnemyBullet(bx, by, ddx / d * speed * 0.9, dy / d * speed * 0.9);
            }
          }
        } else {
          const dx = player.x - bx;
          const dy = player.y - by;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const speed = 4.5;
          this.game.spawnEnemyBullet(bx, by, dx / dist * speed, dy / dist * speed);
        }
      }
    }
  }

  destroy() {
    this.health = 0;
    this.isDestroyed = true;
  }

  draw() {
    if (this.isDestroyed) return;
    const ctx = this.game.ctx;
    const hw = this.size / 2;
    const oscX = Math.sin(Date.now() * 0.003 + this.oscOffset) * (this.oscillateAmp > 0 ? 0 : 3);
    const cx = this.x + hw + oscX;
    const cy = this.y + hw;

    ctx.save();
    ctx.translate(cx, cy);

    const glowR = hw * (this.type === "boss" ? 2.5 : this.type === "miniBoss" ? 2.2 : 1.8);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    glow.addColorStop(0, this.color1 + "25");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    const pts = this.type === "boss" ? 8 : this.type === "miniBoss" ? 6 : 6;
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? hw * 0.85 : hw * 0.55;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, hw);
    bodyGrad.addColorStop(0, this.color1);
    bodyGrad.addColorStop(1, this.color2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = this.eyeColor;
    ctx.lineWidth = this.type === "boss" ? 2.5 : this.type === "miniBoss" ? 2 : 1.5;
    ctx.stroke();

    if (this.type === "boss") {
      ctx.fillStyle = this.eyeColor;
      ctx.beginPath();
      ctx.arc(-10, -6, 6, 0, Math.PI * 2);
      ctx.arc(10, -6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(-10, -6, 3, 0, Math.PI * 2);
      ctx.arc(10, -6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff1744";
      ctx.beginPath();
      ctx.arc(0, 8, 4, 0, Math.PI);
      ctx.fill();
    } else if (this.type === "miniBoss") {
      ctx.fillStyle = this.eyeColor;
      ctx.beginPath();
      ctx.arc(-8, -5, 5, 0, Math.PI * 2);
      ctx.arc(8, -5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(-8, -5, 2.5, 0, Math.PI * 2);
      ctx.arc(8, -5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffd54f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 6, 5, 0, Math.PI);
      ctx.stroke();
    } else {
      const eyeOffset = this.type === "scout" ? 4 : 6;
      const eyeR = this.type === "scout" ? 2.5 : 4;
      ctx.fillStyle = this.eyeColor;
      ctx.beginPath();
      ctx.arc(-eyeOffset, -3, eyeR, 0, Math.PI * 2);
      ctx.arc(eyeOffset, -3, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(-eyeOffset, -3, eyeR * 0.5, 0, Math.PI * 2);
      ctx.arc(eyeOffset, -3, eyeR * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.hitFlashTimer / 6 * 0.6})`;
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    if (this.maxHealth > 1 && !this.isDestroyed) {
      const barW = this.size;
      const barH = 4;
      const barX = this.x;
      const barY = this.y - 8;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = "#76ff03";
      ctx.fillRect(barX, barY, barW * (this.displayHealth / this.maxHealth), barH);
    }
  }
}

export default Enemy;
