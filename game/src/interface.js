// Coral Keys — the HUD, the minimap and the menus.
//
// All interface is plain DOM over the 3D canvas: health, cash, wanted
// stars, the clock, the objective line, the speedometer and ammo, plus
// a round 2D minimap drawn on a canvas. The menus (start, pause,
// busted, wasted, job done) are DOM overlays the game shows and hides.

import { WORLD } from './settings.js';

export function makeHud() {
  const $ = (id) => document.getElementById(id);
  return {
    health: $('health-fill'),
    healthText: $('health-text'),
    cash: $('cash'),
    stars: $('stars'),
    clock: $('clock'),
    objective: $('objective-text'),
    objectiveDist: $('objective-dist'),
    speed: $('speed'),
    ammo: $('ammo'),
    toast: $('toast'),
    crosshair: $('crosshair'),
    minimap: $('minimap'),
    menu: $('menu'),
    menuTitle: $('menu-title'),
    menuText: $('menu-text'),
    menuButton: $('menu-button'),
    paused: $('paused'),
    hint: $('hint'),
  };
}

let toastTimer = null;
export function showToast(hud, text, ms = 2600) {
  hud.toast.textContent = text;
  hud.toast.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    hud.toast.style.opacity = '0';
  }, ms);
}

export function updateHud(hud, state) {
  // state: { health, cash, stars, time, objective, dist, speed, ammo,
  //   weapon, inCar, staged }
  hud.health.style.width = `${Math.max(0, state.health)}%`;
  hud.healthText.textContent = `${Math.ceil(Math.max(0, state.health))}`;
  hud.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
  hud.stars.textContent = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars);
  hud.stars.style.color = state.stars > 0 ? '#ff4444' : '#e8e8e8';
  const hours = Math.floor(state.time / 3600) % 24;
  const mins = Math.floor((state.time % 3600) / 60);
  hud.clock.textContent = `${String(hours % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  hud.objective.textContent = state.objective;
  hud.objectiveDist.textContent = state.dist != null ? `${Math.round(state.dist)}m` : '';
  hud.speed.textContent = state.inCar ? `${Math.round(Math.abs(state.speed) * 3.6)} km/h` : '';
  hud.ammo.textContent = state.weapon === 'pistol' ? `◉ ${state.ammo} / 12` : '✊ fists';
  hud.crosshair.style.display = state.weapon === 'pistol' && !state.inCar ? 'block' : 'none';
  hud.hint.textContent = state.inCar
    ? 'WASD drive · Space handbrake · C camera · E exit · T reset'
    : 'WASD move · Shift run · Space jump · E steal car · F punch · 2 pistol · P pause';
}

// Round minimap: the city grid, the beach, the player arrow, traffic
// dots, police dots and the mission beacon.
export function drawMinimap(hud, world) {
  const canvas = hud.minimap;
  const g = canvas.getContext('2d');
  const S = canvas.width;
  const half = WORLD.half + WORLD.beachWidth + 20;
  const toMap = (x, z) => [S / 2 + (x / half) * (S / 2 - 6), S / 2 + (z / half) * (S / 2 - 6)];
  g.clearRect(0, 0, S, S);
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.fillStyle = '#20242a';
  g.fill();
  g.save();
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.clip();
  // Roads.
  g.strokeStyle = '#3a3f46';
  g.lineWidth = 4;
  for (const l of world.roadLines) {
    const [x1, y1] = toMap(l, -half);
    const [x2, y2] = toMap(l, half);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    const [x3, y3] = toMap(-half, l);
    const [x4, y4] = toMap(half, l);
    g.beginPath();
    g.moveTo(x3, y3);
    g.lineTo(x4, y4);
    g.stroke();
  }
  // Beach strip.
  const [bx] = toMap(WORLD.half, 0);
  g.fillStyle = '#c9b078';
  g.fillRect(bx, 0, S - bx, S);
  // Mission beacon.
  if (world.beacon) {
    const [x, y] = toMap(world.beacon.x, world.beacon.z);
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffd23f';
    g.beginPath();
    g.arc(x, y, 10, 0, Math.PI * 2);
    g.stroke();
  }
  // Traffic dots.
  g.fillStyle = '#9aa7b8';
  for (const t of world.traffic) {
    const [x, y] = toMap(t.x, t.z);
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  // Police dots.
  g.fillStyle = '#3a86ff';
  for (const c of world.cops) {
    const [x, y] = toMap(c.x, c.z);
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI * 2);
    g.fill();
  }
  // Player arrow.
  const [px, py] = toMap(world.player.x, world.player.z);
  g.save();
  g.translate(px, py);
  g.rotate(world.player.heading);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -7);
  g.lineTo(5, 6);
  g.lineTo(-5, 6);
  g.closePath();
  g.fill();
  g.restore();
  g.restore();
  // Rim.
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.strokeStyle = '#ffffff33';
  g.lineWidth = 2;
  g.stroke();
}

export function showMenu(hud, title, text, button) {
  hud.menuTitle.textContent = title;
  hud.menuText.textContent = text;
  hud.menuButton.textContent = button;
  hud.menu.style.display = 'flex';
}

export function hideMenu(hud) {
  hud.menu.style.display = 'none';
}
