# Space Blaster

A fast-paced, single-screen arcade space shooter built with **TypeScript**, **Vite**, and the raw **HTML5 Canvas** (no game framework). Defend the galaxy: dodge enemy fire, chain combos, grab power-ups, and blast your way through escalating waves, mini-bosses, and bosses until you hit the winning score.

## Gameplay

- **Hearts:** you start with a set number of hearts depending on the difficulty. Lose them all and it's game over.
- **Levels & stages:** the game levels up as your score climbs, cycling through themed stages (Deep Space, Nebula, Alien Space, Void) with tougher spawns.
- **Combos:** rack up quick consecutive kills for bonus points.
- **Graze:** skim past enemy bullets without getting hit for extra points and style.

## Images
<img width="1558" height="866" alt="Screenshot 2026-07-17 at 5 51 40 PM" src="https://github.com/user-attachments/assets/db57977e-3d33-49db-9ee9-91a8b790ef1d" />
<img width="1558" height="869" alt="Screenshot 2026-07-17 at 5 52 00 PM" src="https://github.com/user-attachments/assets/b5866b00-75d8-47c3-9d0b-bebb685079fa" />
<img width="1691" height="940" alt="Screenshot 2026-07-17 at 5 35 02 PM" src="https://github.com/user-attachments/assets/f7f7483a-6330-43f7-9521-0ed32b746894" />


## Difficulty modes

| Mode   | Hearts | Feel                    |
| ------ | ------ | ----------------------- |
| Easy   | 8      | slower enemies          |
| Normal | 5      | balanced                |
| Hard   | 3      | faster, denser waves    |

## Features

- **Enemy variety:** normal, scout, tank, shooter, zigzag, kamikaze, and splitter enemies, plus **mini-bosses** and **bosses** with health bars and distinct bullet patterns.
- **Formations:** enemies arrive in V, line, and pincer formations.
- **Power-ups:** spread shot, speed boost, shield, bomb, piercing rounds, homing missiles, magnet, combat drones, rapid fire, and extra life.
- **Achievements:** unlockable milestones tracked locally.
- **Local high score:** your best run is saved in the browser.
- **Juice:** parallax starfields, drifting nebulae, shooting stars, particle explosions, screen shake, and score pop-ups.
- **Sound effects** with a mute toggle (`M`).
- **Flexible input:** keyboard, mouse (with pointer lock), and touch.

### Controls

| Action        | Keys                              |
| ------------- | --------------------------------- |
| Move          | `←` `→` / `A` `D` / mouse / touch  |
| Fire          | auto-fire (toggle with `F`), or hold `Space` / mouse |
| Pause         | `Esc`                             |
| Mute          | `M`                               |
| Menu / select | `Enter` / `Space`, arrows to navigate, `1`/`2`/`3` for difficulty |

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build for production
npm run preview  # preview the production build
```

Then open the URL Vite prints (typically http://localhost:5173).

## Server dashboard / leaderboard (currently disabled)

The project also includes a small backend under [`server/`](server/) — a simple **Express + PostgreSQL** service that acts as an online leaderboard dashboard:

- `GET /api/scores` — fetch the top scores.
- `POST /api/scores` — submit a `{ nickname, score }` entry.

On the client side there's matching UI for it: a **LEADERBOARD** menu screen and a **nickname-entry prompt** shown after a high score, which fetch from and submit to that API (`src/utils/api.ts`).

**This whole leaderboard/dashboard feature is intentionally commented out** in the client (menu entry, leaderboard screen, nickname prompt, and API calls) **because I don't want to deploy the server.** The game runs completely client-side without it. The code is left in place — just disabled — so it can be re-enabled later if I ever decide to host the backend.

## Tech stack

- **Client:** TypeScript, Vite, HTML5 Canvas
- **Server (disabled):** Node.js, Express, PostgreSQL (`pg`)
