diff --git a/main.js b/main.js
new file mode 100644
index 0000000000000000000000000000000000000000..0c605f3236d0adbd721367b9777735e2b63d80a0
--- /dev/null
+++ b/main.js
@@ -0,0 +1,437 @@
+const canvas = document.getElementById("game");
+const ctx = canvas.getContext("2d");
+const healthEl = document.getElementById("health");
+const ammoEl = document.getElementById("ammo");
+const waveEl = document.getElementById("wave");
+const restartBtn = document.getElementById("restart");
+const overlay = document.getElementById("overlay");
+const startBtn = document.getElementById("start");
+const minimap = document.getElementById("minimap");
+
+const state = {
+  running: false,
+  time: 0,
+  wave: 1,
+  blockSize: 48,
+  ammo: 30,
+  maxAmmo: 30,
+  ammoCooldown: 0,
+  dashCooldown: 0,
+  grid: [],
+  bullets: [],
+  enemies: [],
+  particles: [],
+};
+
+const player = {
+  x: canvas.width / 2,
+  y: canvas.height / 2,
+  radius: 14,
+  speed: 160,
+  health: 100,
+  vx: 0,
+  vy: 0,
+  dashTime: 0,
+};
+
+const keys = new Set();
+let mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };
+
+function buildGrid() {
+  const cols = Math.floor(canvas.width / state.blockSize);
+  const rows = Math.floor(canvas.height / state.blockSize);
+  state.grid = [];
+  for (let y = 0; y < rows; y += 1) {
+    const row = [];
+    for (let x = 0; x < cols; x += 1) {
+      const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
+      const chance = edge ? 1 : Math.random() < 0.22;
+      row.push(chance ? { hp: 3 } : null);
+    }
+    state.grid.push(row);
+  }
+}
+
+function spawnEnemies() {
+  state.enemies = [];
+  const count = 3 + state.wave * 2;
+  for (let i = 0; i < count; i += 1) {
+    state.enemies.push({
+      x: Math.random() * canvas.width,
+      y: Math.random() * canvas.height,
+      radius: 12,
+      hp: 3 + state.wave,
+      speed: 50 + state.wave * 6,
+    });
+  }
+}
+
+function resetMatch() {
+  state.time = 0;
+  state.wave = 1;
+  state.ammo = state.maxAmmo;
+  player.health = 100;
+  player.x = canvas.width / 2;
+  player.y = canvas.height / 2;
+  player.vx = 0;
+  player.vy = 0;
+  state.bullets = [];
+  state.particles = [];
+  buildGrid();
+  spawnEnemies();
+  updateHud();
+}
+
+function nextWave() {
+  state.wave += 1;
+  state.ammo = state.maxAmmo;
+  player.health = Math.min(100, player.health + 20);
+  buildGrid();
+  spawnEnemies();
+  updateHud();
+}
+
+function updateHud() {
+  healthEl.textContent = Math.max(0, Math.round(player.health));
+  ammoEl.textContent = state.ammo;
+  waveEl.textContent = state.wave;
+}
+
+function updateMiniMap() {
+  minimap.innerHTML = "";
+  const rows = state.grid.length;
+  const cols = state.grid[0]?.length || 0;
+  for (let y = 0; y < rows; y += 1) {
+    for (let x = 0; x < cols; x += 1) {
+      const cell = document.createElement("span");
+      const block = state.grid[y][x];
+      if (block) {
+        cell.style.background = "rgba(88, 149, 255, 0.7)";
+      }
+      minimap.appendChild(cell);
+    }
+  }
+}
+
+function shoot() {
+  if (state.ammo <= 0 || state.ammoCooldown > 0) {
+    return;
+  }
+  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
+  state.bullets.push({
+    x: player.x,
+    y: player.y,
+    vx: Math.cos(angle) * 420,
+    vy: Math.sin(angle) * 420,
+    life: 1.2,
+  });
+  state.ammo -= 1;
+  state.ammoCooldown = 0.12;
+  updateHud();
+}
+
+function dash() {
+  if (state.dashCooldown > 0) {
+    return;
+  }
+  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
+  player.vx += Math.cos(angle) * 420;
+  player.vy += Math.sin(angle) * 420;
+  player.dashTime = 0.18;
+  state.dashCooldown = 1.6;
+}
+
+function handleInput(dt) {
+  const input = {
+    x: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
+    y: (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0),
+  };
+  const length = Math.hypot(input.x, input.y) || 1;
+  const speed = player.dashTime > 0 ? player.speed * 1.8 : player.speed;
+  player.vx += (input.x / length) * speed * dt;
+  player.vy += (input.y / length) * speed * dt;
+}
+
+function updatePlayer(dt) {
+  player.x += player.vx;
+  player.y += player.vy;
+  player.vx *= 0.82;
+  player.vy *= 0.82;
+  player.dashTime = Math.max(0, player.dashTime - dt);
+  state.dashCooldown = Math.max(0, state.dashCooldown - dt);
+  state.ammoCooldown = Math.max(0, state.ammoCooldown - dt);
+
+  const padding = player.radius + 4;
+  player.x = Math.max(padding, Math.min(canvas.width - padding, player.x));
+  player.y = Math.max(padding, Math.min(canvas.height - padding, player.y));
+}
+
+function updateBullets(dt) {
+  state.bullets = state.bullets.filter((bullet) => {
+    bullet.x += bullet.vx * dt;
+    bullet.y += bullet.vy * dt;
+    bullet.life -= dt;
+    return (
+      bullet.life > 0 &&
+      bullet.x > 0 &&
+      bullet.x < canvas.width &&
+      bullet.y > 0 &&
+      bullet.y < canvas.height
+    );
+  });
+}
+
+function spawnParticle(x, y, color) {
+  state.particles.push({
+    x,
+    y,
+    vx: (Math.random() - 0.5) * 120,
+    vy: (Math.random() - 0.5) * 120,
+    life: 0.6,
+    color,
+  });
+}
+
+function updateParticles(dt) {
+  state.particles = state.particles.filter((particle) => {
+    particle.x += particle.vx * dt;
+    particle.y += particle.vy * dt;
+    particle.life -= dt;
+    return particle.life > 0;
+  });
+}
+
+function bulletHitsBlock(bullet) {
+  const col = Math.floor(bullet.x / state.blockSize);
+  const row = Math.floor(bullet.y / state.blockSize);
+  if (!state.grid[row] || !state.grid[row][col]) {
+    return false;
+  }
+  const block = state.grid[row][col];
+  block.hp -= 1;
+  spawnParticle(bullet.x, bullet.y, "#7cd4ff");
+  if (block.hp <= 0) {
+    state.grid[row][col] = null;
+  }
+  return true;
+}
+
+function updateEnemies(dt) {
+  state.enemies.forEach((enemy) => {
+    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
+    enemy.x += Math.cos(angle) * enemy.speed * dt;
+    enemy.y += Math.sin(angle) * enemy.speed * dt;
+
+    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
+    if (distance < enemy.radius + player.radius) {
+      player.health -= 18 * dt;
+      updateHud();
+    }
+  });
+}
+
+function resolveBulletHits() {
+  state.bullets = state.bullets.filter((bullet) => {
+    if (bulletHitsBlock(bullet)) {
+      return false;
+    }
+    let hitEnemy = false;
+    state.enemies.forEach((enemy) => {
+      const distance = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
+      if (distance < enemy.radius) {
+        enemy.hp -= 1;
+        hitEnemy = true;
+        spawnParticle(bullet.x, bullet.y, "#ff9e59");
+      }
+    });
+    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
+    return !hitEnemy;
+  });
+}
+
+function update(dt) {
+  state.time += dt;
+  handleInput(dt);
+  updatePlayer(dt);
+  updateBullets(dt);
+  updateParticles(dt);
+  updateEnemies(dt);
+  resolveBulletHits();
+
+  if (state.enemies.length === 0) {
+    nextWave();
+  }
+
+  if (player.health <= 0) {
+    state.running = false;
+    overlay.classList.remove("hidden");
+  }
+}
+
+function drawGrid() {
+  state.grid.forEach((row, y) => {
+    row.forEach((block, x) => {
+      if (!block) {
+        return;
+      }
+      const healthShade = 60 + block.hp * 45;
+      ctx.fillStyle = `rgb(${healthShade}, ${160}, ${255})`;
+      ctx.fillRect(
+        x * state.blockSize + 3,
+        y * state.blockSize + 3,
+        state.blockSize - 6,
+        state.blockSize - 6
+      );
+    });
+  });
+}
+
+function drawPlayer() {
+  ctx.save();
+  ctx.translate(player.x, player.y);
+  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
+  ctx.rotate(angle);
+  ctx.fillStyle = "#7cd4ff";
+  ctx.beginPath();
+  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
+  ctx.fill();
+  ctx.fillStyle = "#0b0f18";
+  ctx.fillRect(player.radius - 2, -4, 14, 8);
+  ctx.restore();
+}
+
+function drawEnemies() {
+  state.enemies.forEach((enemy) => {
+    ctx.fillStyle = "#ff7a7a";
+    ctx.beginPath();
+    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
+    ctx.fill();
+  });
+}
+
+function drawBullets() {
+  ctx.fillStyle = "#ffd66e";
+  state.bullets.forEach((bullet) => {
+    ctx.beginPath();
+    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
+    ctx.fill();
+  });
+}
+
+function drawParticles() {
+  state.particles.forEach((particle) => {
+    ctx.fillStyle = particle.color;
+    ctx.globalAlpha = Math.max(0, particle.life / 0.6);
+    ctx.beginPath();
+    ctx.arc(particle.x, particle.y, 2.2, 0, Math.PI * 2);
+    ctx.fill();
+    ctx.globalAlpha = 1;
+  });
+}
+
+function drawHud() {
+  ctx.fillStyle = "rgba(10, 15, 26, 0.8)";
+  ctx.fillRect(14, 14, 140, 60);
+  ctx.fillStyle = "#7cd4ff";
+  ctx.font = "12px sans-serif";
+  ctx.fillText(`Dash ${state.dashCooldown > 0 ? "..." : "Ready"}`, 24, 38);
+  ctx.fillText(`Ammo ${state.ammo}/${state.maxAmmo}`, 24, 58);
+}
+
+function render() {
+  ctx.clearRect(0, 0, canvas.width, canvas.height);
+  ctx.fillStyle = "#0c101a";
+  ctx.fillRect(0, 0, canvas.width, canvas.height);
+  drawGrid();
+  drawParticles();
+  drawEnemies();
+  drawBullets();
+  drawPlayer();
+  drawHud();
+}
+
+let lastTime = 0;
+function loop(timestamp) {
+  if (!state.running) {
+    lastTime = timestamp;
+    requestAnimationFrame(loop);
+    return;
+  }
+  const dt = Math.min(0.02, (timestamp - lastTime) / 1000);
+  lastTime = timestamp;
+  update(dt);
+  render();
+  requestAnimationFrame(loop);
+}
+
+window.addEventListener("keydown", (event) => {
+  keys.add(event.code);
+  if (event.code === "Space") {
+    dash();
+  }
+});
+
+window.addEventListener("keyup", (event) => {
+  keys.delete(event.code);
+});
+
+canvas.addEventListener("mousemove", (event) => {
+  const rect = canvas.getBoundingClientRect();
+  mouse = {
+    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
+    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
+    down: mouse.down,
+  };
+});
+
+canvas.addEventListener("mousedown", () => {
+  mouse.down = true;
+  shoot();
+});
+
+canvas.addEventListener("mouseup", () => {
+  mouse.down = false;
+});
+
+canvas.addEventListener("mouseleave", () => {
+  mouse.down = false;
+});
+
+function autoFire(dt) {
+  if (!mouse.down) {
+    return;
+  }
+  state.ammoCooldown = Math.max(0, state.ammoCooldown - dt);
+  if (state.ammoCooldown === 0) {
+    shoot();
+  }
+}
+
+function tickAutoFire(timestamp) {
+  if (!state.running) {
+    requestAnimationFrame(tickAutoFire);
+    return;
+  }
+  const dt = Math.min(0.02, (timestamp - lastTime) / 1000);
+  autoFire(dt);
+  requestAnimationFrame(tickAutoFire);
+}
+
+restartBtn.addEventListener("click", () => {
+  resetMatch();
+  overlay.classList.add("hidden");
+  state.running = true;
+  updateMiniMap();
+});
+
+startBtn.addEventListener("click", () => {
+  resetMatch();
+  overlay.classList.add("hidden");
+  state.running = true;
+  updateMiniMap();
+});
+
+resetMatch();
+updateMiniMap();
+requestAnimationFrame(loop);
+requestAnimationFrame(tickAutoFire);
