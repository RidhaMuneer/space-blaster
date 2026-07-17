import type Enemy from "../enemy/enemy";
import type { EnemyType } from "../enemy/enemy";
import type Player from "../player/player";

interface HitInfo {
  x: number;
  y: number;
  isBoss: boolean;
  points: number;
  type: EnemyType;
}

class CollisionCheck {
  static checkBulletEnemy(
    player: Player,
    enemies: Enemy[],
    onHit?: (info: HitInfo) => void
  ) {
    player.bullets.forEach((bullet) => {
      enemies.forEach((enemy) => {
        if (enemy.isDestroyed || bullet.isDestroyed) return;

        if (
          CollisionCheck.rectsIntersect(
            { x: bullet.x, y: bullet.y, width: bullet.SIZE_X, height: bullet.SIZE_Y },
            { x: enemy.x, y: enemy.y, width: enemy.size, height: enemy.size }
          )
        ) {
          if (!bullet.isPiercing) {
            bullet.destroy();
          }
          enemy.takeDamage();
          if (enemy.isDestroyed && onHit) {
            onHit({
              x: enemy.x + enemy.size / 2,
              y: enemy.y + enemy.size / 2,
              isBoss: enemy.type === "boss" || enemy.type === "miniBoss",
              points: enemy.points,
              type: enemy.type,
            });
          }
        }
      });
    });
  }

  static checkPlayerPowerUp(
    player: Player,
    powerUps: { x: number; y: number; getRect(): { x: number; y: number; width: number; height: number }; collected: boolean; type: string }[]
  ) {
    for (const pu of powerUps) {
      if (pu.collected) continue;
      if (
        CollisionCheck.rectsIntersect(
          { x: player.x - player.SIZE / 2, y: player.y - player.SIZE / 2, width: player.SIZE, height: player.SIZE },
          pu.getRect()
        )
      ) {
        pu.collected = true;
        return pu.type;
      }
    }
    return null;
  }

  static checkEnemyBulletPlayer(
    player: Player,
    bullets: { x: number; y: number; size: number; isDestroyed: boolean }[]
  ): boolean {
    if (player.isInvulnerable) return false;
    for (const b of bullets) {
      if (b.isDestroyed) continue;
      if (
        CollisionCheck.rectsIntersect(
          { x: player.x - player.SIZE / 2, y: player.y - player.SIZE / 2, width: player.SIZE, height: player.SIZE },
          { x: b.x - b.size / 2, y: b.y - b.size / 2, width: b.size, height: b.size }
        )
      ) {
        b.isDestroyed = true;
        return true;
      }
    }
    return false;
  }

  static checkGraze(
    player: Player,
    bullets: { x: number; y: number; size: number; isDestroyed: boolean }[]
  ): number {
    let grazeCount = 0;
    for (const b of bullets) {
      if (b.isDestroyed) continue;
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < player.SIZE * 0.9 && dist > player.SIZE * 0.4) {
        grazeCount++;
      }
    }
    return grazeCount;
  }

  static rectsIntersect(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }
}

export type { HitInfo };
export default CollisionCheck;
