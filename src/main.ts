import { inject } from "@vercel/analytics";
import Game from "./game/game";

// Vercel Web Analytics (vanilla / non-framework usage).
inject();

const canvas = document.getElementById("game") as HTMLCanvasElement;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resize();
window.addEventListener("resize", resize);

const game = new Game(canvas);

function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}

loop();
