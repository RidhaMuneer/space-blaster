type ParticleKind = "dot" | "spark";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: ParticleKind;
  gravity: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

class ParticleSystem {
  particles: Particle[] = [];
  shockwaves: Shockwave[] = [];

  emit(x: number, y: number, color: string, count: number = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 25 + Math.random() * 20,
        maxLife: 45,
        color,
        size: Math.random() * 3 + 1.5,
        kind: "dot",
        gravity: 0.06,
      });
    }
  }

  // Fast, bright streaks that fly outward and fade quickly.
  emitSparks(x: number, y: number, color: string, count: number = 12, power: number = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 5 + 3) * power;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 14 + Math.random() * 14,
        maxLife: 28,
        color,
        size: Math.random() * 1.6 + 0.8,
        kind: "spark",
        gravity: 0.02,
      });
    }
  }

  // An expanding ring used for impactful explosions.
  emitShockwave(x: number, y: number, color: string, maxRadius: number = 60, width: number = 3) {
    this.shockwaves.push({
      x,
      y,
      radius: 2,
      maxRadius,
      life: 18,
      maxLife: 18,
      color,
      width,
    });
  }

  // A composite "big explosion": core burst + sparks + shockwave.
  explosion(x: number, y: number, color: string, scale: number = 1) {
    this.emit(x, y, color, Math.round(14 * scale));
    this.emitSparks(x, y, "#ffffff", Math.round(8 * scale), scale);
    this.emitSparks(x, y, color, Math.round(10 * scale), scale * 1.2);
    this.emitShockwave(x, y, color, 50 * scale, 2 + scale);
  }

  update() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      if (p.kind === "spark") {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const s of this.shockwaves) {
      s.radius += (s.maxRadius - s.radius) * 0.22;
      s.life--;
    }
    this.shockwaves = this.shockwaves.filter((s) => s.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const s of this.shockwaves) {
      const alpha = s.life / s.maxLife;
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.kind === "spark") {
        const tailX = p.x - p.vx * 2;
        const tailY = p.y - p.vy * 2;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export default ParticleSystem;
