# Paku Grove

A charming, animal-themed Pac-Man-style arcade game for **Project PakuTest**.

**Play live:** [https://rpfeil.github.io/paku-grove/](https://rpfeil.github.io/paku-grove/)

Guide **Bunny** through a twilight forest maze. Nibble clover and berries, avoid woodland predators, and grab a **golden acorn** power-up to briefly turn the chase.

## Theme

| Role | Character |
|------|-----------|
| Player (prey) | Bunny |
| Predators | Fox, Owl, Weasel, Lynx |
| Pellets | Clover / berry nibbles |
| Power-up | Golden acorn (frightens predators) |

Soft forest dusk palette, expressive display type, and light motion — cute chase energy, no gore.

## How to run

No build step. Any static file server works; opening the file directly is fine in most browsers.

### Option A — open the file

```bash
cd paku-grove
open index.html          # macOS
# or: xdg-open index.html  # Linux
# or double-click index.html
```

### Option B — local server (recommended)

```bash
cd paku-grove
python3 -m http.server 5173
```

Then visit [http://localhost:5173](http://localhost:5173).

### Option C — Node

```bash
cd paku-grove
npx --yes serve -l 5173
```

## Controls

| Input | Action |
|-------|--------|
| Arrow keys or WASD | Move |
| Space | Pause / resume |
| R | Restart |
| On-screen pad (mobile) | Move |
| **Start hopping** button | Begin / continue / replay |

## Gameplay

- Collect every clover nibble and berry to clear the grove (win / next level).
- Touching a predator costs a life (3 lives).
- Golden acorns frighten predators for a few seconds — tag them for bonus points.
- Score and lives stay on the HUD; win and lose screens offer restart.

## Files

- `index.html` — page shell and HUD
- `styles.css` — atmosphere, layout, overlay
- `game.js` — maze, AI, input, render loop
