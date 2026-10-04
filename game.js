(() => {
  "use strict";

  const TILE = 20;
  const COLS = 28;
  const ROWS = 31;
  const SPEED = 1.7;
  const PREDATOR_SPEED = 1.45;
  const FRIGHT_SPEED = 1.05;
  const FRIGHT_MS = 6500;
  const START_LIVES = 3;

  // 0 wall, 1 pellet, 2 empty, 3 power, 4 gate
  const MAZE = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "     #.##### ## #####.#     ",
    "     #.##          ##.#     ",
    "     #.## ###--### ##.#     ",
    "######.## #      # ##.######",
    "      .   #      #   .      ",
    "######.## #      # ##.######",
    "     #.## ######## ##.#     ",
    "     #.##          ##.#     ",
    "     #.## ######## ##.#     ",
    "######.## ######## ##.######",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#.####.#####.##.#####.####.#",
    "#o..##................##..o#",
    "###.##.##.########.##.##.###",
    "###.##.##.########.##.##.###",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#.##########.##.##########.#",
    "#..........................#",
    "############################",
  ];

  const DIRS = {
    none: { x: 0, y: 0, name: "none" },
    left: { x: -1, y: 0, name: "left" },
    right: { x: 1, y: 0, name: "right" },
    up: { x: 0, y: -1, name: "up" },
    down: { x: 0, y: 1, name: "down" },
  };

  const OPPOSITE = {
    left: "right",
    right: "left",
    up: "down",
    down: "up",
    none: "none",
  };

  const PREDATORS = [
    { name: "Fox", color: "#e07a3a", ear: "#c45a22", personality: "chase", home: { x: 13.5, y: 14 } },
    { name: "Owl", color: "#6b8cae", ear: "#4d6f8f", personality: "ambush", home: { x: 14.5, y: 14 } },
    { name: "Weasel", color: "#c4a06a", ear: "#a07e4a", personality: "patrol", home: { x: 12.5, y: 14 } },
    { name: "Lynx", color: "#b07090", ear: "#8f5474", personality: "wander", home: { x: 15.5, y: 14 } },
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlay-kicker");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayBody = document.getElementById("overlay-body");
  const startBtn = document.getElementById("start-btn");

  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;

  let grid = [];
  let pelletCount = 0;
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let state = "title"; // title | playing | paused | won | lost | dying
  let frightUntil = 0;
  let combo = 0;
  let lastTs = 0;
  let animT = 0;
  let dieUntil = 0;

  const bunny = {
    x: 14,
    y: 23,
    dir: DIRS.left,
    next: DIRS.none,
    mouth: 0,
  };

  let predators = [];

  function parseMaze() {
    grid = [];
    pelletCount = 0;
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        const ch = MAZE[y][x];
        let cell = 0;
        if (ch === "#") cell = 0;
        else if (ch === ".") {
          cell = 1;
          pelletCount++;
        } else if (ch === "o") {
          cell = 3;
          pelletCount++;
        } else if (ch === "-") cell = 4;
        else cell = 2;
        row.push(cell);
      }
      grid.push(row);
    }
  }

  function resetActors() {
    bunny.x = 14;
    bunny.y = 23;
    bunny.dir = DIRS.left;
    bunny.next = DIRS.none;
    bunny.mouth = 0;
    predators = PREDATORS.map((p, i) => ({
      ...p,
      x: p.home.x,
      y: p.home.y,
      dir: i % 2 === 0 ? DIRS.left : DIRS.right,
      mode: "scatter",
      released: false,
      releaseAt: performance.now() + 400 + i * 1600,
    }));
    frightUntil = 0;
    combo = 0;
  }

  function tileAt(x, y) {
    if (y < 0 || y >= ROWS) return 0;
    const tx = ((Math.floor(x) % COLS) + COLS) % COLS;
    return grid[Math.floor(y)][tx];
  }

  function isWall(x, y, allowGate = false) {
    if (y < 0 || y >= ROWS) return true;
    const cell = tileAt(x, y);
    if (cell === 0) return true;
    if (cell === 4 && !allowGate) return true;
    return false;
  }

  function centered(entity) {
    return Math.abs(entity.x - Math.round(entity.x)) < 0.08 && Math.abs(entity.y - Math.round(entity.y)) < 0.08;
  }

  function snap(entity) {
    entity.x = Math.round(entity.x * 1000) / 1000;
    entity.y = Math.round(entity.y * 1000) / 1000;
    if (Math.abs(entity.x - Math.round(entity.x)) < 0.08) entity.x = Math.round(entity.x);
    if (Math.abs(entity.y - Math.round(entity.y)) < 0.08) entity.y = Math.round(entity.y);
  }

  function canMove(entity, dir, allowGate = false) {
    if (dir.name === "none") return false;
    const nx = entity.x + dir.x * 0.51;
    const ny = entity.y + dir.y * 0.51;
    // Tunnel wrap
    if (ny >= 0 && ny < ROWS && (nx < 0 || nx >= COLS)) return dir.y === 0;
    const corners = [
      [nx - 0.35, ny - 0.35],
      [nx + 0.35, ny - 0.35],
      [nx - 0.35, ny + 0.35],
      [nx + 0.35, ny + 0.35],
    ];
    return corners.every(([cx, cy]) => !isWall(cx, cy, allowGate));
  }

  function moveEntity(entity, speed, allowGate = false) {
    if (centered(entity) && entity.next && entity.next.name !== "none" && canMove(entity, entity.next, allowGate)) {
      entity.dir = entity.next;
    }
    if (!canMove(entity, entity.dir, allowGate)) {
      snap(entity);
      return;
    }
    entity.x += entity.dir.x * speed;
    entity.y += entity.dir.y * speed;
    if (entity.x < -0.5) entity.x = COLS - 0.5;
    if (entity.x > COLS - 0.5) entity.x = -0.5;
  }

  function dist(ax, ay, bx, by) {
    return (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  }

  function choicesAt(entity, allowGate = false) {
    return [DIRS.up, DIRS.left, DIRS.down, DIRS.right].filter((d) => canMove(entity, d, allowGate));
  }

  function targetFor(p) {
    const bx = bunny.x;
    const by = bunny.y;
    if (performance.now() < frightUntil) {
      return { x: p.home.x + (Math.random() - 0.5) * 8, y: p.home.y + (Math.random() - 0.5) * 8 };
    }
    switch (p.personality) {
      case "chase":
        return { x: bx, y: by };
      case "ambush":
        return { x: bx + bunny.dir.x * 4, y: by + bunny.dir.y * 4 };
      case "patrol":
        return { x: COLS - 1 - bx, y: ROWS - 1 - by };
      default:
        return Math.hypot(p.x - bx, p.y - by) < 6
          ? { x: p.home.x, y: p.home.y }
          : { x: bx, y: by };
    }
  }

  function updatePredator(p, dt) {
    if (!p.released) {
      if (performance.now() >= p.releaseAt) {
        p.released = true;
        p.x = 13.5 + (Math.random() < 0.5 ? 0 : 1);
        p.y = 11;
        p.dir = Math.random() < 0.5 ? DIRS.left : DIRS.right;
      } else {
        p.y = p.home.y + Math.sin(animT * 0.005 + p.home.x) * 0.15;
        return;
      }
    }

    const frightened = performance.now() < frightUntil;
    const speed = (frightened ? FRIGHT_SPEED : PREDATOR_SPEED) * (0.95 + level * 0.04);

    if (centered(p)) {
      snap(p);
      let opts = choicesAt(p, false);
      // Prefer not reversing unless only option
      const filtered = opts.filter((d) => d.name !== OPPOSITE[p.dir.name]);
      if (filtered.length) opts = filtered;

      const target = targetFor(p);
      if (frightened) {
        p.dir = opts[Math.floor(Math.random() * opts.length)] || p.dir;
      } else {
        let best = opts[0] || p.dir;
        let bestScore = Infinity;
        for (const d of opts) {
          const scoreD = dist(p.x + d.x, p.y + d.y, target.x, target.y);
          if (scoreD < bestScore) {
            bestScore = scoreD;
            best = d;
          }
        }
        p.dir = best;
      }
    }

    moveEntity(p, speed * (dt / 16.67), false);
  }

  function eatAtBunny() {
    const tx = Math.round(bunny.x);
    const ty = Math.round(bunny.y);
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return;
    const cell = grid[ty][tx];
    if (cell === 1) {
      grid[ty][tx] = 2;
      pelletCount--;
      score += 10;
    } else if (cell === 3) {
      grid[ty][tx] = 2;
      pelletCount--;
      score += 50;
      frightUntil = performance.now() + FRIGHT_MS;
      combo = 0;
      for (const p of predators) {
        if (p.released) p.dir = DIRS[OPPOSITE[p.dir.name]] || p.dir;
      }
    }
    scoreEl.textContent = String(score);
    if (pelletCount <= 0) winLevel();
  }

  function collide() {
    for (const p of predators) {
      if (!p.released) continue;
      if (Math.hypot(p.x - bunny.x, p.y - bunny.y) < 0.65) {
        if (performance.now() < frightUntil) {
          combo += 1;
          score += 200 * combo;
          scoreEl.textContent = String(score);
          p.x = p.home.x;
          p.y = p.home.y;
          p.released = false;
          p.releaseAt = performance.now() + 2200;
        } else {
          loseLife();
          return;
        }
      }
    }
  }

  function loseLife() {
    lives -= 1;
    updateLives();
    if (lives <= 0) {
      state = "lost";
      showOverlay(
        "Caught!",
        "The predators won this round",
        "Bunny got cornered in the grove. Try another hop — the clover is still waiting.",
        "Play again"
      );
      return;
    }
    state = "dying";
    dieUntil = performance.now() + 900;
  }

  function winLevel() {
    level += 1;
    levelEl.textContent = String(level);
    state = "won";
    showOverlay(
      "Grove cleared!",
      "Every nibble collected",
      `Level ${level - 1} complete. Predators grow a little bolder — ready for another maze?`,
      "Next level"
    );
  }

  function updateLives() {
    livesEl.textContent = "●".repeat(Math.max(0, lives)) || "—";
  }

  function showOverlay(kicker, title, body, button) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayBody.textContent = body;
    startBtn.textContent = button;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function startGame(fromTitle = false) {
    if (state === "lost" || fromTitle) {
      score = 0;
      lives = START_LIVES;
      level = 1;
      scoreEl.textContent = "0";
      levelEl.textContent = "1";
      updateLives();
    }
    parseMaze();
    resetActors();
    hideOverlay();
    state = "playing";
    lastTs = performance.now();
  }

  function update(dt) {
    if (state === "dying") {
      if (performance.now() >= dieUntil) {
        resetActors();
        state = "playing";
      }
      return;
    }
    if (state !== "playing") return;

    if (bunny.next.name !== "none" && centered(bunny) && canMove(bunny, bunny.next)) {
      bunny.dir = bunny.next;
    }
    const speed = SPEED * (0.96 + level * 0.03);
    moveEntity(bunny, speed * (dt / 16.67));
    bunny.mouth += dt * 0.012;
    eatAtBunny();
    for (const p of predators) updatePredator(p, dt);
    collide();
  }

  function drawWallCell(x, y) {
    const px = x * TILE;
    const py = y * TILE;
    const g = ctx.createLinearGradient(px, py, px + TILE, py + TILE);
    g.addColorStop(0, "#1a4a36");
    g.addColorStop(1, "#0d2a20");
    ctx.fillStyle = g;
    ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "rgba(143, 191, 154, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
  }

  function drawPellet(x, y, power) {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2;
    if (power) {
      const pulse = 0.75 + Math.sin(animT * 0.008) * 0.25;
      ctx.fillStyle = "#f0a84a";
      ctx.beginPath();
      ctx.ellipse(cx, cy - 1, 5.2 * pulse, 6.5 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7a4a18";
      ctx.fillRect(cx - 1, cy - 8 * pulse, 2, 3);
      ctx.fillStyle = "rgba(255, 210, 122, 0.55)";
      ctx.beginPath();
      ctx.arc(cx - 1.5, cy - 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // clover / berry nibble
      ctx.fillStyle = "#8fbf9a";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6ea87c";
      ctx.beginPath();
      ctx.arc(cx - 1.5, cy - 0.5, 1.4, 0, Math.PI * 2);
      ctx.arc(cx + 1.5, cy - 0.5, 1.4, 0, Math.PI * 2);
      ctx.arc(cx, cy + 1.4, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBunny() {
    const cx = bunny.x * TILE + TILE / 2;
    const cy = bunny.y * TILE + TILE / 2;
    const r = TILE * 0.42;
    const open = 0.25 + (Math.sin(bunny.mouth) * 0.5 + 0.5) * 0.45;
    let start = open;
    let end = Math.PI * 2 - open;
    if (bunny.dir.name === "left") {
      start = Math.PI + open;
      end = Math.PI - open;
    } else if (bunny.dir.name === "up") {
      start = -Math.PI / 2 + open;
      end = -Math.PI / 2 - open;
    } else if (bunny.dir.name === "down") {
      start = Math.PI / 2 + open;
      end = Math.PI / 2 - open;
    }

    // ears
    ctx.fillStyle = "#f2d7b8";
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - r + 2, 3.2, 7.5, -0.25, 0, Math.PI * 2);
    ctx.ellipse(cx + 5, cy - r + 2, 3.2, 7.5, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4a7b9";
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - r + 1, 1.4, 4.2, -0.25, 0, Math.PI * 2);
    ctx.ellipse(cx + 5, cy - r + 1, 1.4, 4.2, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f5e0c4";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end, false);
    ctx.closePath();
    ctx.fill();

    // eye
    const eyeX =
      bunny.dir.name === "left" ? cx - 3 : bunny.dir.name === "right" ? cx + 3 : cx + (bunny.dir.name === "up" ? 3 : -1);
    const eyeY =
      bunny.dir.name === "up" ? cy - 3 : bunny.dir.name === "down" ? cy + 2 : cy - 3;
    ctx.fillStyle = "#1a2a22";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPredator(p) {
    const cx = p.x * TILE + TILE / 2;
    const cy = p.y * TILE + TILE / 2;
    const frightened = performance.now() < frightUntil && p.released;
    const body = frightened ? "#7ec8c8" : p.color;
    const ear = frightened ? "#5aa0a8" : p.ear;

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy - 1, TILE * 0.38, Math.PI, 0);
    ctx.lineTo(cx + TILE * 0.38, cy + TILE * 0.32);
    for (let i = 0; i < 4; i++) {
      const x1 = cx + TILE * 0.38 - (i + 0.5) * (TILE * 0.19);
      const y1 = cy + TILE * 0.18;
      const x2 = cx + TILE * 0.38 - (i + 1) * (TILE * 0.19);
      const y2 = cy + TILE * 0.32;
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();

    // ears / tufts
    ctx.fillStyle = ear;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 6);
    ctx.lineTo(cx - 3, cy - 13);
    ctx.lineTo(cx + 0.5, cy - 6);
    ctx.moveTo(cx + 7, cy - 6);
    ctx.lineTo(cx + 3, cy - 13);
    ctx.lineTo(cx - 0.5, cy - 6);
    ctx.fill();

    ctx.fillStyle = frightened ? "#17343a" : "#1a1814";
    const blink = frightened && Math.floor(animT / 180) % 2 === 0;
    if (!blink) {
      ctx.beginPath();
      ctx.arc(cx - 3.5, cy - 2, 1.7, 0, Math.PI * 2);
      ctx.arc(cx + 3.5, cy - 2, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!frightened) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 2.6, 0.6, 0, Math.PI * 2);
      ctx.arc(cx + 3, cy - 2.6, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGate(x, y) {
    ctx.fillStyle = "rgba(240, 168, 74, 0.65)";
    ctx.fillRect(x * TILE + 2, y * TILE + TILE / 2 - 1, TILE - 4, 2);
  }

  function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.35,
      20,
      canvas.width * 0.5,
      canvas.height * 0.5,
      canvas.width * 0.7
    );
    bg.addColorStop(0, "#0f2a20");
    bg.addColorStop(1, "#061410");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (cell === 0) drawWallCell(x, y);
        else if (cell === 1 || cell === 3) drawPellet(x, y, cell === 3);
        else if (cell === 4) drawGate(x, y);
      }
    }

    // soft vignette
    const vig = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.25,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.72
    );
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state !== "dying" || Math.floor(animT / 100) % 2 === 0) drawBunny();
    for (const p of predators) drawPredator(p);

    if (performance.now() < frightUntil && state === "playing") {
      const left = Math.max(0, frightUntil - performance.now());
      ctx.fillStyle = "rgba(240, 168, 74, 0.9)";
      ctx.font = "700 12px Nunito, sans-serif";
      ctx.fillText(`Power acorn! ${Math.ceil(left / 1000)}s`, 12, 16);
    }

    if (state === "paused") {
      ctx.fillStyle = "rgba(5, 16, 12, 0.45)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f4efe4";
      ctx.font = "700 28px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Paused", canvas.width / 2, canvas.height / 2);
      ctx.textAlign = "left";
    }
  }

  function loop(ts) {
    const dt = Math.min(34, ts - lastTs || 16);
    lastTs = ts;
    animT += dt;
    update(dt);
    drawBoard();
    requestAnimationFrame(loop);
  }

  function setDir(name) {
    if (!DIRS[name]) return;
    bunny.next = DIRS[name];
    if (state === "playing" && canMove(bunny, DIRS[name])) {
      bunny.dir = DIRS[name];
    }
  }

  const keyMap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    a: "left",
    d: "right",
    w: "up",
    s: "down",
    A: "left",
    D: "right",
    W: "up",
    S: "down",
  };

  window.addEventListener("keydown", (e) => {
    if (keyMap[e.key]) {
      e.preventDefault();
      setDir(keyMap[e.key]);
      return;
    }
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (state === "playing") state = "paused";
      else if (state === "paused") {
        state = "playing";
        lastTs = performance.now();
      }
      return;
    }
    if (e.key === "r" || e.key === "R") {
      startGame(true);
    }
  });

  document.querySelectorAll(".touch-pad button").forEach((btn) => {
    const apply = (ev) => {
      ev.preventDefault();
      setDir(btn.dataset.dir);
    };
    btn.addEventListener("pointerdown", apply);
  });

  startBtn.addEventListener("click", () => {
    if (state === "won") {
      parseMaze();
      resetActors();
      hideOverlay();
      state = "playing";
      lastTs = performance.now();
      return;
    }
    startGame(state === "title" || state === "lost");
  });

  // boot
  parseMaze();
  resetActors();
  updateLives();
  showOverlay(
    "Ready?",
    "Nibble the grove",
    "Guide Bunny through the twilight maze. Collect clover and berries, dodge Fox, Owl, Weasel, and Lynx — and snag a golden acorn to turn the chase.",
    "Start hopping"
  );
  requestAnimationFrame((ts) => {
    lastTs = ts;
    loop(ts);
  });
})();
