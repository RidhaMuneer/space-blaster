import type Game from "../game/game";
import type Enemy from "../enemy/enemy";

class Bullet {
  game: Game;
  SIZE_X = 4;
  SIZE_Y = 14;
  x: number;
  y: number;
  isDestroyed: boolean = false;
  isHoming: boolean = false;
  homingTarget: Enemy | null = null;
  isPiercing: boolean = false;

  constructor(gameInstance: Game, x: number, y: number, isHoming: boolean = false, isPiercing: boolean = false) {
    this.game = gameInstance;
    this.x = x - this.SIZE_X / 2;
    this.y = y - this.SIZE_Y;
    this.isHoming = isHoming;
    this.isPiercing = isPiercing;
  }

  update() {
    if (this.isHoming && this.homingTarget && !this.homingTarget.isDestroyed) {
      const dx = this.homingTarget.x + this.homingTarget.size / 2 - (this.x + this.SIZE_X / 2);
      const dy = this.homingTarget.y + this.homingTarget.size / 2 - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const speed = 20;
        this.x += (dx / dist) * speed;
        this.y += (dy / dist) * speed;
      }
      this.x = Math.max(0, Math.min(this.game.canvas.width - this.SIZE_X, this.x));
    } else {
      this.y -= 20;
    }
  }

  draw() {
    const ctx = this.game.ctx;
    const cx = this.x + this.SIZE_X / 2;
    const cy = this.y + this.SIZE_Y / 2;

    if (this.isHoming) {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
      glow.addColorStop(0, "rgba(224, 64, 251, 0.3)");
      glow.addColorStop(1, "rgba(224, 64, 251, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e040fb";
      ctx.fillRect(this.x - 1, this.y, this.SIZE_X + 2, this.SIZE_Y);
      ctx.fillStyle = "#f3e5f5";
      ctx.fillRect(this.x + 0.5, this.y + 1, this.SIZE_X - 1, this.SIZE_Y - 2);
    } else if (this.isPiercing) {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
      glow.addColorStop(0, "rgba(255, 64, 129, 0.4)");
      glow.addColorStop(1, "rgba(255, 64, 129, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff4081";
      ctx.fillRect(this.x - 1, this.y, this.SIZE_X + 2, this.SIZE_Y);
      ctx.fillStyle = "#fce4ec";
      ctx.fillRect(this.x + 0.5, this.y + 1, this.SIZE_X - 1, this.SIZE_Y - 2);
    } else {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
      glow.addColorStop(0, "rgba(255, 255, 100, 0.3)");
      glow.addColorStop(1, "rgba(255, 255, 100, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff176";
      ctx.fillRect(this.x, this.y, this.SIZE_X, this.SIZE_Y);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(this.x + 0.5, this.y + 1, this.SIZE_X - 1, this.SIZE_Y - 2);
    }
  }

  destroy() {
    if (!this.isPiercing) {
      this.isDestroyed = true;
    }
  }
}

export default Bullet;
