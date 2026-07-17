export type PowerUpType = "spread" | "speed" | "shield" | "bomb" | "piercing" | "homing" | "magnet" | "extraLife" | "drone" | "rapidFire";

export const POWERUP_COLORS: Record<PowerUpType, string> = {
  spread: "#76ff03",
  speed: "#ffea00",
  shield: "#448aff",
  bomb: "#ff6d00",
  piercing: "#ff4081",
  homing: "#e040fb",
  magnet: "#00bcd4",
  extraLife: "#ff1744",
  drone: "#18ffff",
  rapidFire: "#ff9100",
};

export const POWERUP_LABELS: Record<PowerUpType, string> = {
  spread: "\u2605",
  speed: "\u2191",
  shield: "\u25CA",
  bomb: "\u25C6",
  piercing: "\u2192",
  homing: "\u2699",
  magnet: "\u2297",
  extraLife: "\u2764",
  drone: "\u25B2",
  rapidFire: "\u00BB",
};

export const POWERUP_NAMES: Record<PowerUpType, string> = {
  spread: "SPREAD",
  speed: "SPEED",
  shield: "SHIELD",
  bomb: "BOMB",
  piercing: "PIERCE",
  homing: "HOMING",
  magnet: "MAGNET",
  extraLife: "1-UP",
  drone: "DRONE",
  rapidFire: "RAPID",
};

class PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  size = 22;
  speed = 1.5;
  collected = false;
  oscOffset: number;

  constructor(x: number, y: number, type: PowerUpType) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.oscOffset = Math.random() * Math.PI * 2;
  }

  update() {
    this.y += this.speed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.005 + this.oscOffset);
    const r = (this.size / 2) * pulse;
    const cx = this.x;
    const cy = this.y;
    const color = POWERUP_COLORS[this.type];

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
    glow.addColorStop(0, color + "60");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(POWERUP_LABELS[this.type], cx, cy + 0.5);
  }

  getRect() {
    const r = this.size / 2;
    return { x: this.x - r, y: this.y - r, width: this.size, height: this.size };
  }
}

export default PowerUp;
