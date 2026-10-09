# Carom

A top-down paddle duel about timing, spin, and bank shots. Slide into a return to curve the ball, use the two amber obstacles to change its path, and send it past your opponent. Play against the computer or share a keyboard with a friend. First to 11 wins, with a two-point lead.

Everything is drawn on a canvas and sound is synthesized by the Simple 2D engine. The game runs entirely in your browser, without accounts, servers, downloaded assets, or runtime network requests.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. To build and preview the production site:

```sh
npm run build
npm run preview
```

The complete static site is in `dist/`. Serve that directory at the root of any static host.

## Controls

| Action | Keys |
| --- | --- |
| Solo movement | W / S or ↑ / ↓ |
| Versus player one | W / S |
| Versus player two | ↑ / ↓ |
| Select a menu item | W / S or ↑ / ↓, mouse, or touch |
| Confirm | Enter or Space, click, or tap |
| Pause / resume | P or Escape |
| Back | Escape |
| Toggle sound | M |
| Engine diagnostics | Backtick |

Touch controls appear on touch input: use the vertical sliders along the sides to move and the engine's buttons for menu actions. Move your paddle while making contact to add spin. A stationary return keeps its existing spin; spin fades as the ball travels. Paddle hits increase speed, while obstacles and walls preserve it.

## Development

`src/game.ts` declares the state and debug contract and registers engine services. `simulation.ts` advances physics without a renderer, `menus.ts` handles screen transitions and input, `state.ts` implements debug poses, and `render.ts` draws the game. Engine documentation and the full specification are in `engine/` and `specs/`.

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests instantiate the real engine with an in-process canvas and a controlled clock. They cover menus, pointer and touch interactions, movement, AI, spin, collisions, scoring, and the debug surface. Test and coverage reports are generated in `coverage/`.

The player-facing description, screenshots, and engine-recorded rally are in `showcase/`.
