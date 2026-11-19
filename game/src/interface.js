// Coral Keys — the HUD, the round minimap, and the menu screens.
//
// The HUD is plain DOM over the 3D canvas: health bar, cash, wanted
// stars, the clock, the objective line with its distance, the
// speedometer, ammo and the weapon name, plus a crosshair. The minimap
// is a small 2D canvas: streets, the sea, the player arrow, police
// blips, the objective marker and the mission beacon. Menus (start,
// pause, busted, wasted, job done) are DOM panels the boot loop shows
// and hides; buttons call back into the boot loop.

import { WORLD } from './settings.js';

export class Interface {
  constructor(doc) {
    this.doc = doc;
    this.el = {};
    for (const id of [
      'hud', 'health-fill', 'health-num', 'money', 'stars', 'clock',
      'objective', 'speed', 'ammo', 'weapon', 'crosshair', 'toast',
      'menu', 'menu-title', 'menu-sub', 'menu-play', 'menu-continue',
      'pause', 'pause-resume', 'pause-restart', 'busted', 'busted-retry',
      'wasted', 'wasted-retry', 'done', 'done-again', 'hint',
    ]) {
      this.el[id] = doc.getElementById(id);
    }
    this.map = doc.getElementById('minimap');
    this.mapCtx = this.map?.getContext('2d') ?? null;
    this.toastTimer = 0;
  }

  show(id) {
    this.el[id]?.classList.remove('hidden');
  }
  hide(id) {
    this.el[id]?.classList.add('hidden');
  }
  showOnly(ids) {
    for (const id of ['menu', 'pause', 'busted', 'wasted', 'done']) {
      if (ids.includes(id)) this.show(id);
      else this.hide(id);
    }
  }

  setMenu(title, sub, showContinue) {
    this.el['menu-title'].textContent = title;
    this.el['menu-sub'].textContent = sub;
    if (showContinue) this.show('menu-continue');
    else this.hide('menu-continue');
  }

  toast(text, seconds = 3) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    this.toastTimer = seconds;
  }

  updateHud(s) {
    if (!this.el.hud) return;
    this.el['health-fill'].style.width = `${Math.max(0, s.health)}%`;
    this.el['health-num'].textContent = `${Math.ceil(s.health)}`;
    this.el.money.textContent = `$${s.money.toLocaleString('en-US')}`;
    this.el.stars.textContent = '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars);
    this.el.stars.classList.toggle('hot', s.stars > 0);
    const h = Math.floor(s.clock / 3600) % 24;
    const m = Math.floor(s.clock / 60) % 60;
    this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.el.objective.textContent = s.objective;
    this.el.speed.textContent = s.inCar ? `${Math.round(Math.abs(s.speed) * 3.6)} km/h` : '';
    this.el.ammo.textContent = s.weapon === 'pistol' ? `${s.ammo} / ${s.reserveAmmo}` : '—';
    this.el.weapon.textContent = s.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
    this.el.crosshair.style.display = s.weapon === 'pistol' && !s.inCar ? 'block' : 'none';
    if (this.toastTimer > 0) {
      this.toastTimer -= s.dt;
      if (this.toastTimer <= 0) this.el.toast.classList.add('hidden');
    }
    this.el.hint.textContent = s.inCar
      ? 'W/S drive · A/D steer · Space handbrake · E exit · C camera'
      : 'WASD move · Shift run · Space jump · E steal car · F punch · Click shoot · R reload';
  }

  // Draw the round minimap: streets in grey, sea in blue, the player
  // as a white arrow, police as red dots, the objective as a gold star.
  drawMap(s) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const size = this.map.width;
    const cx = size / 2;
    const cy = size / 2;
    const range = WORLD.half + 40;
    const toMap = (x, z) => [cx + (x / range) * (size / 2 - 6), cy + (z / range) * (size / 2 - 6)];
    ctx.clearRect(0, 0, size, size);
    // Clip to the round face.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#20262b';
    ctx.fillRect(0, 0, size, size);
    // Sea on the east edge.
    ctx.fillStyle = '#1f7fa8';
    const [seaX] = toMap(WORLD.half, 0);
    ctx.fillRect(seaX, 0, size, size);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 3;
    for (let k = 0; k <= WORLD.blocks; k++) {
      const c = -WORLD.half + WORLD.roadWidth / 2 + k * WORLD.pitch;
      const [x1, y1] = toMap(c, -range);
      const [x2, y2] = toMap(c, range);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(-range, c);
      const [x4, y4] = toMap(range, c);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    // Objective marker.
    if (s.objectiveTarget) {
      const [ox, oy] = toMap(s.objectiveTarget.x, s.objectiveTarget.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(ox, oy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ox, oy, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Police blips.
    ctx.fillStyle = '#ff4444';
    for (const p of s.police) {
      const [px, py] = toMap(p.x, p.z);
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, rotated to the heading.
    const [px, py] = toMap(s.player.x, s.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(s.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Rim.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
