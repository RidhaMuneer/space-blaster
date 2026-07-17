import { POWERUP_COLORS, POWERUP_NAMES } from "../powerup/power-up";

interface ScoreBoxParams {
  score: number;
  lives: number;
  level: number;
  levelProgress: number;
  winScore: number;
  comboCount: number;
  activePowerUp: { type: string; remaining: number } | null;
  muted: boolean;
  highScore: number;
  grazeTotal?: number;
  autoFire: boolean;
}

const LEVEL_COLORS = ["#00e5ff", "#ff5252", "#76ff03", "#e040fb"];

function levelColor(l: number): string {
  if (l <= 5) return LEVEL_COLORS[0];
  if (l <= 10) return LEVEL_COLORS[1];
  if (l <= 15) return LEVEL_COLORS[2];
  return LEVEL_COLORS[3];
}

function formatScore(n: number): string {
  return n.toLocaleString();
}

class ScoreBox {
  draw(ctx: CanvasRenderingContext2D, p: ScoreBoxParams) {
    const canvas = ctx.canvas;
    const barH = 58;
    const lc = levelColor(p.level);

    ctx.save();

    const grad = ctx.createLinearGradient(0, 0, 0, barH);
    grad.addColorStop(0, "rgba(8, 8, 30, 0.82)");
    grad.addColorStop(1, "rgba(4, 4, 20, 0.92)");
    ctx.fillStyle = grad;
    this.roundRect(ctx, 0, 0, canvas.width, barH, 0, 0, 10, 10);
    ctx.fill();

    ctx.strokeStyle = `rgba(0, 200, 255, 0.08)`;
    ctx.lineWidth = 1;
    this.roundRect(ctx, 0, 0, canvas.width, barH, 0, 0, 10, 10);
    ctx.stroke();

    const pillX = 14;
    const pillW = 60;
    const pillH = 26;
    const pillY = 8;
    ctx.save();
    ctx.shadowColor = lc;
    ctx.shadowBlur = 8;
    this.roundRect(ctx, pillX, pillY, pillW, pillH, 6);
    ctx.fillStyle = lc + "18";
    ctx.fill();
    ctx.strokeStyle = lc + "40";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.fillStyle = lc;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`LVL ${p.level}`, pillX + pillW / 2, pillY + pillH / 2);

    const scoreX = pillX + pillW + 16;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "8px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("SCORE", scoreX, pillY + 8);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px monospace";
    ctx.fillText(formatScore(p.score), scoreX, pillY + pillH - 6);

    const rightEdge = canvas.width - 14;

    // Hearts. Show individual hearts up to a limit, then collapse to "\u2764 \u00d7N"
    // so a high heart count doesn't overflow the HUD.
    const heartsStr = p.lives <= 6
      ? "\u2764 ".repeat(Math.max(0, p.lives)).trim()
      : `\u2764 \u00d7${p.lives}`;
    ctx.font = "16px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ff1744";
    ctx.shadowColor = "rgba(255, 23, 68, 0.3)";
    ctx.shadowBlur = 4;
    ctx.fillText(heartsStr, rightEdge, pillY + pillH / 2 + 1);
    ctx.shadowBlur = 0;
    const heartsW = heartsStr ? ctx.measureText(heartsStr).width : 0;

    // [S]/[M] and [A] indicators sit just to the left of the hearts.
    const indicatorRight = rightEdge - heartsW - (heartsW > 0 ? 16 : 0);
    ctx.fillStyle = p.muted ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.35)";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(p.muted ? "[M]" : "[S]", indicatorRight, pillY + pillH / 2 + 0.5);

    if (p.autoFire) {
      ctx.fillStyle = "rgba(76, 175, 80, 0.35)";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("[A]", indicatorRight - 34, pillY + pillH / 2 + 0.5);
    }

    const barY = 42;
    const barLeft = 120;
    const barRight = Math.min(rightEdge - 130, canvas.width - 200);
    const barW = barRight - barLeft;
    const barH2 = 6;

    ctx.save();
    this.roundRect(ctx, barLeft, barY, barW, barH2, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();

    if (p.levelProgress > 0) {
      const fillW = Math.max(barW * p.levelProgress, 4);
      ctx.save();
      this.roundRect(ctx, barLeft, barY, fillW, barH2, 3);
      const fillGrad = ctx.createLinearGradient(barLeft, 0, barLeft + barW, 0);
      fillGrad.addColorStop(0, lc);
      fillGrad.addColorStop(1, lc + "80");
      ctx.fillStyle = fillGrad;
      ctx.shadowColor = lc;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    const toNext = 1500 - (p.score % 1500);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${formatScore(toNext)} pts`, barLeft + barW / 2, barY + barH2 + 2);

    const remaining = p.winScore - p.score;
    if (remaining > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(`${formatScore(remaining)} to win`, rightEdge, barY + barH2 + 2);
    } else {
      ctx.fillStyle = "#00e676";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText("VICTORY", rightEdge, barY + barH2 + 2);
    }

    if (p.comboCount >= 3) {
      const comboAlpha = Math.min(1, (p.comboCount - 2) / 5);
      ctx.globalAlpha = comboAlpha;
      ctx.save();
      ctx.translate(barLeft + barW / 2, barY - 1);
      ctx.shadowColor = "#ffea00";
      ctx.shadowBlur = 6;
      ctx.fillStyle = "#ffea00";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${p.comboCount}x COMBO`, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (p.activePowerUp) {
      const color = POWERUP_COLORS[p.activePowerUp.type as keyof typeof POWERUP_COLORS] || "#fff";
      const name = POWERUP_NAMES[p.activePowerUp.type as keyof typeof POWERUP_NAMES] || p.activePowerUp.type;
      ctx.fillStyle = color;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      const label = p.activePowerUp.type === "shield" ? `${name}` : `${name} ${(p.activePowerUp.remaining / 1000).toFixed(1)}s`;
      ctx.fillText(label, 14, barY + barH2 + 14);
      ctx.shadowBlur = 0;
    }

    if (p.grazeTotal && p.grazeTotal > 0) {
      ctx.fillStyle = "rgba(0, 188, 212, 0.4)";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const gx = p.activePowerUp ? 14 + ctx.measureText("PIERCE 0.0s").width + 16 : 14;
      ctx.fillText(`GRAZE ${p.grazeTotal}`, gx, barY + barH2 + 14);
    }

    ctx.restore();
  }

  roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    tl: number, tr: number = tl, br: number = tl, bl: number = tl
  ) {
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }
}

export default ScoreBox;
