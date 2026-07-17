import Bullet from "../bullet/bullet";
import Game from "../game/game";
import type { PowerUpType } from "../powerup/power-up";

class Player {
  x: number;
  y: number;
  game: Game;
  SPEED = 15;
  SIZE: number = 40;
  MOVE_LEFT = false;
  MOVE_RIGHT = false;
  bullets: Bullet[] = [];
  lastBulletShotTime: number = 0;
  score: number = 0;
  lives: number = 3;
  isInvulnerable: boolean = false;
  invulnerableTimer: number = 0;
  comboCount: number = 0;
  lastKillTime: number = 0;
  COMBO_WINDOW = 1500;
  hasShield: boolean = false;
  spreadShot: boolean = false;
  speedBoost: boolean = false;
  piercingShot: boolean = false;
  homingMissile: boolean = false;
  magnet: boolean = false;
  drone: boolean = false;
  rapidFire: boolean = false;
  hitFlashTimer: number = 0;
  spreadTimer: number = 0;
  speedTimer: number = 0;
  piercingTimer: number = 0;
  homingTimer: number = 0;
  magnetTimer: number = 0;
  droneTimer: number = 0;
  rapidTimer: number = 0;
  POWERUP_DURATION = 6000;
  DRONE_DURATION = 12000;
  untouched: boolean = true;
  grazeTotal: number = 0;
  lastGrazeTime: number = 0;
  isFiring: boolean = false;

  constructor(gameInstance: Game) {
    this.x = gameInstance.canvas.width / 2;
    this.y = gameInstance.canvas.height - 100;
    this.game = gameInstance;
  }

  clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
  }

  update() {
    if (this.game.mouseX !== null) {
      const diff = this.game.mouseX - this.x;
      if (Math.abs(diff) > 2) {
        this.x += Math.sign(diff) * Math.min(Math.abs(diff), this.SPEED * (this.speedBoost ? 2 : 1));
      }
    } else {
      const s = this.SPEED * (this.speedBoost ? 2 : 1);
      if (this.MOVE_LEFT) this.x -= s;
      if (this.MOVE_RIGHT) this.x += s;
    }
    this.x = this.clamp(this.x, this.SIZE / 2, this.game.canvas.width - this.SIZE / 2);
    this.handleBulletsUpdate();
    if (this.game.autoFire || this.isFiring) this.shoot();
    this.updateTimers();
    if (this.hitFlashTimer > 0) this.hitFlashTimer--;
  }

  updateTimers() {
    // Expire the post-hit invulnerability here (in the update loop) so the grace
    // period ends reliably even on frames where the ship isn't drawn (it blinks).
    if (this.isInvulnerable && Date.now() - this.invulnerableTimer >= 1000) {
      this.isInvulnerable = false;
    }
    if (Date.now() - this.lastKillTime > this.COMBO_WINDOW) {
      this.comboCount = 0;
    }
    if (this.spreadShot && Date.now() - this.spreadTimer > this.POWERUP_DURATION) {
      this.spreadShot = false;
    }
    if (this.speedBoost && Date.now() - this.speedTimer > this.POWERUP_DURATION) {
      this.speedBoost = false;
    }
    if (this.piercingShot && Date.now() - this.piercingTimer > this.POWERUP_DURATION) {
      this.piercingShot = false;
    }
    if (this.homingMissile && Date.now() - this.homingTimer > this.POWERUP_DURATION) {
      this.homingMissile = false;
    }
    if (this.magnet && Date.now() - this.magnetTimer > this.POWERUP_DURATION) {
      this.magnet = false;
    }
    if (this.drone && Date.now() - this.droneTimer > this.DRONE_DURATION) {
      this.drone = false;
    }
    if (this.rapidFire && Date.now() - this.rapidTimer > this.POWERUP_DURATION) {
      this.rapidFire = false;
    }
  }

  dronePositions(): { x: number; y: number }[] {
    if (!this.drone) return [];
    const bob = Math.sin(Date.now() * 0.006) * 4;
    return [
      { x: this.x - this.SIZE * 0.95, y: this.y + 6 + bob },
      { x: this.x + this.SIZE * 0.95, y: this.y + 6 - bob },
    ];
  }

  draw() {
    if (this.isInvulnerable) {
      if (Date.now() - this.invulnerableTimer >= 1000) {
        this.isInvulnerable = false;
      }
      if (Math.floor(Date.now() / 100) % 2 === 0) return;
    }

    const ctx = this.game.ctx;
    const hw = this.SIZE / 2;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.hasShield) {
      const shieldPulse = 0.9 + 0.1 * Math.sin(Date.now() * 0.006);
      ctx.strokeStyle = `rgba(68, 138, 255, ${0.3 * shieldPulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, hw + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.magnet) {
      const r = hw + 20 + 5 * Math.sin(Date.now() * 0.005);
      ctx.strokeStyle = "rgba(0, 188, 212, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const glow = ctx.createRadialGradient(0, hw, 0, 0, hw, 18);
    glow.addColorStop(0, "rgba(0, 200, 255, 0.6)");
    glow.addColorStop(1, "rgba(0, 200, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-15, hw - 5, 30, 20);

    if (this.speedBoost) {
      ctx.shadowColor = "#ffea00";
      ctx.shadowBlur = 8;
    }
    if (this.piercingShot) {
      ctx.shadowColor = "#ff4081";
      ctx.shadowBlur = 6;
    }
    if (this.homingMissile) {
      ctx.shadowColor = "#e040fb";
      ctx.shadowBlur = 6;
    }
    if (this.rapidFire) {
      ctx.shadowColor = "#ff9100";
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.moveTo(0, -hw);
    ctx.lineTo(-hw * 0.65, 0);
    ctx.lineTo(-hw * 0.9, hw);
    ctx.lineTo(-hw * 0.3, hw * 0.8);
    ctx.lineTo(hw * 0.3, hw * 0.8);
    ctx.lineTo(hw * 0.9, hw);
    ctx.lineTo(hw * 0.65, 0);
    ctx.closePath();

    const shipGrad = ctx.createLinearGradient(0, -hw, 0, hw);
    if (this.piercingShot) {
      shipGrad.addColorStop(0, "#ff4081");
      shipGrad.addColorStop(1, "#880e4f");
    } else if (this.homingMissile) {
      shipGrad.addColorStop(0, "#e040fb");
      shipGrad.addColorStop(1, "#4a148c");
    } else {
      shipGrad.addColorStop(0, this.spreadShot ? "#76ff03" : "#4dd0e1");
      shipGrad.addColorStop(1, this.spreadShot ? "#558b2f" : "#008394");
    }
    ctx.fillStyle = shipGrad;
    ctx.fill();
    ctx.strokeStyle = this.piercingShot ? "#f48fb1" : this.homingMissile ? "#ce93d8" : "#80deea";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(0, -hw * 0.15, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#e0f7fa";
    ctx.fill();

    ctx.beginPath();
    const flameLen = 15 + Math.random() * 10 + 5 * Math.sin(Date.now() * 0.015);
    const flicker = 2 + Math.random() * 3;
    // outer glow
    ctx.moveTo(-8, hw * 0.7);
    ctx.lineTo(0, hw + flameLen + flicker);
    ctx.lineTo(8, hw * 0.7);
    ctx.fillStyle = "rgba(100, 200, 255, 0.15)";
    ctx.fill();
    // mid glow
    ctx.beginPath();
    ctx.moveTo(-5, hw * 0.75);
    ctx.lineTo(0, hw + flameLen * 0.7 + flicker * 0.5);
    ctx.lineTo(5, hw * 0.75);
    ctx.fillStyle = "rgba(0, 150, 255, 0.35)";
    ctx.fill();
    // core flame
    ctx.beginPath();
    ctx.moveTo(-3, hw * 0.8);
    ctx.lineTo(0, hw + flameLen * 0.4);
    ctx.lineTo(3, hw * 0.8);
    ctx.fillStyle = "rgba(200, 240, 255, 0.6)";
    ctx.fill();

    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.hitFlashTimer / 8 * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(0, -this.SIZE/2);
      ctx.lineTo(-this.SIZE/2 * 0.65, 0);
      ctx.lineTo(-this.SIZE/2 * 0.9, this.SIZE/2);
      ctx.lineTo(-this.SIZE/2 * 0.3, this.SIZE/2 * 0.8);
      ctx.lineTo(this.SIZE/2 * 0.3, this.SIZE/2 * 0.8);
      ctx.lineTo(this.SIZE/2 * 0.9, this.SIZE/2);
      ctx.lineTo(this.SIZE/2 * 0.65, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    this.drawDrones(ctx);
    this.bullets.forEach((bullet) => bullet.draw());
  }

  drawDrones(ctx: CanvasRenderingContext2D) {
    for (const d of this.dronePositions()) {
      ctx.save();
      ctx.translate(d.x, d.y);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
      glow.addColorStop(0, "rgba(24, 255, 255, 0.45)");
      glow.addColorStop(1, "rgba(24, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(-7, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(7, 7);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -9, 0, 7);
      g.addColorStop(0, "#84ffff");
      g.addColorStop(1, "#0097a7");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "#e0ffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, -2, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  handleBulletsUpdate() {
    this.bullets.forEach((bullet) => bullet.update());
    this.bullets = this.bullets.filter((b) => b.y > 0 && b.y < this.game.canvas.height + 20 && !b.isDestroyed);
  }

  addScore(points: number): number {
    this.comboCount++;
    this.lastKillTime = Date.now();
    const comboBonus = Math.floor(this.comboCount / 5) * 100;
    const total = points + comboBonus;
    this.score += total;
    return total;
  }

  shoot() {
    const now = Date.now();
    const interval = this.rapidFire ? 90 : 200;
    if (now - this.lastBulletShotTime >= interval) {
      this.lastBulletShotTime = now;
      this.bullets.push(new Bullet(this.game, this.x, this.y - this.SIZE / 2, this.homingMissile, this.piercingShot));
      if (this.spreadShot) {
        this.bullets.push(new Bullet(this.game, this.x - 12, this.y - this.SIZE / 2 + 6, this.homingMissile, this.piercingShot));
        this.bullets.push(new Bullet(this.game, this.x + 12, this.y - this.SIZE / 2 + 6, this.homingMissile, this.piercingShot));
      }
      for (const d of this.dronePositions()) {
        this.bullets.push(new Bullet(this.game, d.x, d.y - 8, this.homingMissile, this.piercingShot));
      }
      this.game.soundManager.shoot();
    }
  }

  activatePowerUp(type: PowerUpType) {
    switch (type) {
      case "spread":
        this.spreadShot = true;
        this.spreadTimer = Date.now();
        break;
      case "speed":
        this.speedBoost = true;
        this.speedTimer = Date.now();
        break;
      case "shield":
        this.hasShield = true;
        break;
      case "bomb":
        this.game.bombPowerUp();
        break;
      case "piercing":
        this.piercingShot = true;
        this.piercingTimer = Date.now();
        break;
      case "homing":
        this.homingMissile = true;
        this.homingTimer = Date.now();
        break;
      case "magnet":
        this.magnet = true;
        this.magnetTimer = Date.now();
        break;
      case "drone":
        this.drone = true;
        this.droneTimer = Date.now();
        break;
      case "rapidFire":
        this.rapidFire = true;
        this.rapidTimer = Date.now();
        break;
      case "extraLife":
        this.lives++;
        break;
    }
    this.game.soundManager.powerUp();
  }

  reset(lives: number) {
    this.x = this.game.canvas.width / 2;
    this.y = this.game.canvas.height - 100;
    this.bullets = [];
    this.lastBulletShotTime = 0;
    this.score = 0;
    this.lives = lives;
    this.isInvulnerable = false;
    this.comboCount = 0;
    this.hasShield = false;
    this.spreadShot = false;
    this.speedBoost = false;
    this.piercingShot = false;
    this.homingMissile = false;
    this.magnet = false;
    this.drone = false;
    this.rapidFire = false;
    this.untouched = true;
    this.grazeTotal = 0;
    this.lastGrazeTime = 0;
  }
}

export default Player;
