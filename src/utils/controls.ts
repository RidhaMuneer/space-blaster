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

    // Unified pointer handler shared by mouse clicks and touch taps. `x`/`y`
    // are viewport (client) coordinates, which match the canvas coordinate
    // space since the canvas fills the window.
    // Returns true if the tap was "consumed" by a UI element (button/menu),
    // so the caller knows not to also treat it as a move/fire.
    const pointerDown = (x: number, y: number): boolean => {
      const g = this.game;

      // On-screen action buttons (pause / resume / restart / menu) win first.
      for (const b of g.actionButtons) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.runAction(b.id);
          return true;
        }
      }

      if (g.state === "menu" && g.menuScreen === "main") {
        const diffKeys = ["easy", "normal", "hard"];
        for (let i = 0; i < g.diffCardBounds.length; i++) {
          const c = g.diffCardBounds[i];
          if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
            g.setDifficulty(diffKeys[i]);
            return true;
          }
        }
        for (let i = 0; i < g.menuBtnBounds.length; i++) {
          const btn = g.menuBtnBounds[i];
          if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
            g.menuSelection = i;
            g.activateMenuSelection();
            return true;
          }
        }
        return true;
      }

      if (g.state === "playing") { g.player.isFiring = true; return false; }
      return true;
    };

    window.addEventListener("mousedown", (e) => pointerDown(e.clientX, e.clientY));
    window.addEventListener("mouseup", () => {
      this.game.player.isFiring = false;
    });

    window.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      const consumed = pointerDown(touch.clientX, touch.clientY);
      // If the tap wasn't a button, and we're playing, steer toward the finger.
      if (!consumed && this.game.state === "playing") this.game.mouseX = touch.clientX;
      // Prevent the synthesized mouse events / double-tap zoom / scroll.
      e.preventDefault();
    }, { passive: false });

    window.addEventListener("touchmove", (e) => {
      if (this.game.state === "playing") {
        const touch = e.touches[0];
        if (touch) this.game.mouseX = touch.clientX;
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener("touchend", () => {
      this.game.player.isFiring = false;
    });
  }

  // Dispatches an on-screen button press (pause / resume / restart / menu).
  runAction(id: string) {
    const g = this.game;
    switch (id) {
      case "pause":
        if (g.state === "playing") g.togglePause();
        break;
      case "resume":
        if (g.state === "paused") g.togglePause();
        break;
      case "restart":
        g.resetGame();
        break;
      case "menu":
        g.backToMenu();
        break;
    }
  }
}

export default Controls;
