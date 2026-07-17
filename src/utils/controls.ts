import type Game from "../game/game";

const MOVEMENT_KEYS = ["ArrowLeft", "ArrowRight", "a", "A", "d", "D"];
const LEFT_KEYS = ["ArrowLeft", "a", "A"];
const RIGHT_KEYS = ["ArrowRight", "d", "D"];

class Controls {
  constructor(public game: Game) {}

  initControls() {
    const handleKey = (e: KeyboardEvent, pressed: boolean) => {
      if (e.repeat && (e.key === "Escape" || MOVEMENT_KEYS.includes(e.key))) return;
      if (this.game.state === "menu") {
        if (!pressed) return;
        const ms = this.game.menuScreen;
        if (ms === "main") {
          // Leaderboard disabled for now (client-side only).
          // if (e.key === "l" || e.key === "L") { this.game.openLeaderboard(); return; }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            this.game.cycleMenuSelection(e.key === "ArrowUp" ? -1 : 1);
            return;
          }
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            this.game.cycleDifficulty(e.key === "ArrowLeft" ? -1 : 1);
            return;
          }
          if (e.key === "1") { this.game.setDifficulty("easy"); return; }
          if (e.key === "2") { this.game.setDifficulty("normal"); return; }
          if (e.key === "3") { this.game.setDifficulty("hard"); return; }
          if (e.key === "Enter" || e.key === " ") {
            this.game.activateMenuSelection();
            e.preventDefault();
          }
          if (e.key === "Escape") return;
        } else if (ms === "settings") {
          if (e.key === "Escape" || e.key === "Backspace") { this.game.menuScreen = "main"; return; }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            this.game.cycleMenuSelection(e.key === "ArrowUp" ? -1 : 1);
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            this.game.activateMenuSelection();
            return;
          }
          if (e.key === "m" || e.key === "M") { this.game.toggleMute(); return; }
        }
        return;
      }

      // Leaderboard screen disabled for now (client-side only).
      // if (this.game.state === "leaderboard") {
      //   if (!pressed) return;
      //   if (e.key === "Escape" || e.key === "Backspace") { this.game.backToMenu(); return; }
      //   if (e.key === "Enter" || e.key === " ") { this.game.backToMenu(); return; }
      //   return;
      // }

      if (this.game.state === "gameover" || this.game.state === "won") {
        if (!pressed) return;
        if (e.key === "Enter" || e.key === " ") {
          this.game.resetGame();
          e.preventDefault();
          return;
        }
        if (e.key === "q" || e.key === "Q" || e.key === "Escape" || e.key === "Backspace") {
          this.game.backToMenu();
          return;
        }
        return;
      }

      if (this.game.state === "paused") {
        if (!pressed) return;
        if (e.key === "Escape") { e.preventDefault(); this.game.togglePause(); return; }
        if (e.key === "q" || e.key === "Q") { this.game.backToMenu(); return; }
        if (e.key === "m" || e.key === "M") { this.game.toggleMute(); return; }
        return;
      }

      if (this.game.state === "playing") {
        if (e.key === "Escape") { if (!pressed) return; e.preventDefault(); this.game.togglePause(); return; }
        if (e.key === "m" || e.key === "M") { if (!pressed) return; this.game.toggleMute(); return; }
        if (e.key === "f" || e.key === "F") { if (!pressed) return; this.game.autoFire = !this.game.autoFire; return; }
        if (e.key === " ") { this.game.player.isFiring = pressed; e.preventDefault(); return; }
        if (MOVEMENT_KEYS.includes(e.key)) {
          this.game.player.MOVE_LEFT = LEFT_KEYS.includes(e.key) && pressed;
          this.game.player.MOVE_RIGHT = RIGHT_KEYS.includes(e.key) && pressed;
        }
        return;
      }
    };

    window.addEventListener("keydown", (e) => handleKey(e, true));
    window.addEventListener("keyup", (e) => handleKey(e, false));

    window.addEventListener("mousemove", (e) => {
      if (this.game.state === "playing") {
        if (document.pointerLockElement === this.game.canvas) {
          this.game.player.x += e.movementX;
          this.game.player.x = Math.max(
            this.game.player.SIZE / 2,
            Math.min(this.game.canvas.width - this.game.player.SIZE / 2, this.game.player.x)
          );
          this.game.mouseX = null;
        } else {
          this.game.mouseX = e.clientX;
        }
      } else {
        this.game.mouseX = e.clientX;
      }
    });

    let lockLostGuard: ReturnType<typeof setTimeout> | null = null;
    document.addEventListener("pointerlockchange", () => {
      if (!document.pointerLockElement && this.game.state === "playing") {
        if (lockLostGuard) return;
        lockLostGuard = setTimeout(() => {
          lockLostGuard = null;
          if (this.game.state === "playing") {
            this.game.togglePause();
          }
        }, 150);
      } else if (document.pointerLockElement) {
        if (lockLostGuard) {
          clearTimeout(lockLostGuard);
          lockLostGuard = null;
        }
      }
    });

    window.addEventListener("mousedown", () => {
      if (this.game.state === "playing") {
        this.game.player.isFiring = true;
      }
    });
    window.addEventListener("mouseup", () => {
      this.game.player.isFiring = false;
    });

    window.addEventListener("click", (e) => {
      if (this.game.state === "playing") {
        this.game.player.isFiring = true;
      }
      if (this.game.state === "menu" && this.game.menuScreen === "main") {
        const diffKeys = ["easy", "normal", "hard"];
        const cardW = 160;
        const cardGap = 18;
        const cx = this.game.canvas.width / 2;
        const cardsTotalW = 3 * cardW + 2 * cardGap;
        const cardsStartX = cx - cardsTotalW / 2;
        const cardsY = 200;

        for (let i = 0; i < 3; i++) {
          const x = cardsStartX + i * (cardW + cardGap);
          if (e.clientX >= x && e.clientX <= x + cardW && e.clientY >= cardsY && e.clientY <= cardsY + 54) {
            this.game.setDifficulty(diffKeys[i]);
            return;
          }
        }

        for (let i = 0; i < this.game.menuBtnBounds.length; i++) {
          const btn = this.game.menuBtnBounds[i];
          if (e.clientX >= btn.x && e.clientX <= btn.x + btn.w && e.clientY >= btn.y && e.clientY <= btn.y + btn.h) {
            this.game.menuSelection = i;
            this.game.activateMenuSelection();
            return;
          }
        }

        // Leaderboard button disabled for now (client-side only).
        // const b = this.game.leaderboardBtnBounds;
        // if (e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h) {
        //   this.game.openLeaderboard();
        //   return;
        // }
      }
    });

    window.addEventListener("touchmove", (e) => {
      if (this.game.state === "playing") {
        this.game.mouseX = e.touches[0].clientX;
      }
    }, { passive: true });

    window.addEventListener("touchstart", () => {
      if (this.game.state === "menu" && this.game.menuScreen === "main") {
        this.game.startGame();
      }
    });
  }
}

export default Controls;
