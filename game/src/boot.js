// Coral Keys — boot: the game loop, input, camera and staging.
//
// Wires every module together: the renderer, the third-person camera,
// keyboard + mouse input, the menu state machine, the save file, the
// ?shot= staging used for the screenshots, and the live debug handle
// window.__coralKeys the tests read.

import * as THREE from 'three';
import { WORLD, HERO, CAR, FIGHT, CONTROLS, SAVE_KEY } from './settings.js';
import { buildCity } from './city.js';
import { makeRng } from './seed.js';
import { makeHero, updateHero, setWorldBounds } from './hero.js';
import {
  makeCarMesh, makeTrafficCar, updateTraffic, makePlayerCar, drivePlayerCar, nearestCar,
} from './cars.js';
import { makePedestrian, updatePedestrian } from './people.js';
import { makeWanted, setStars, addStars, updateCops } from './cops.js';
import {
  makeGuard, removeGuard, updateGuards, damageGuard, shootPistol, punch,
} from './fight.js';
import {
  makeQuests, currentMission, missionObjectiveText, missionTarget,
  updateQuests, updateBeacon, disposeQuests,
} from './quests.js';
import {
  makeHud, updateHud, drawMinimap, showToast, showMenu, hideMenu,
} from './interface.js';
import {
  unlockAudio, setEngine, setSiren, startMusic, playGunshot, playCash, playPickup,
} from './sound.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || '1');
const SHOT = params.get('shot');
const STAGED = Boolean(SHOT);

const hud = makeHud();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9e8);
scene.fog = new THREE.Fog(0x8ec9e8, 180, 520);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(120, 180, 60);
scene.add(sun);

const city = buildCity(scene, SEED);
setWorldBounds(WORLD.half, WORLD.half + WORLD.beachWidth - 2);
const rng = makeRng(SEED * 7919 + 13);

const hero = makeHero(scene, city.places.spawn);
const traffic = [];
for (let i = 0; i < CAR.trafficCount; i++) {
  traffic.push(makeTrafficCar(scene, rng, city.roadLines));
}
const walkers = [];
for (let i = 0; i < 18; i++) {
  walkers.push(makePedestrian(scene, rng, city.roadLines));
}
const parkedCars = [];
const wanted = makeWanted();
const quests = makeQuests(scene);
let guards = [];
let playerCar = makePlayerCar(scene, 0xc23b2e);
playerCar.mesh.visible = false;

const game = {
  state: 'menu', // menu | playing | paused | busted | wasted | done
  time: 8 * 3600, // the in-game clock starts at 08:00
  camYaw: Math.PI,
  camPitch: 0.32,
  camMode: 0,
  inCar: false,
  weapon: 'fists',
  ammo: FIGHT.pistolMag,
  dragging: false,
  lastX: 0,
  lastY: 0,
  mouseDown: false,
  keys: {},
};

// --- input ------------------------------------------------------------------
const input = {
  get forward() { return !!game.keys[CONTROLS.forward]; },
  get back() { return !!game.keys[CONTROLS.back]; },
  get left() { return !!game.keys[CONTROLS.left]; },
  get right() { return !!game.keys[CONTROLS.right]; },
  get run() { return !!game.keys[CONTROLS.run]; },
  get jump() { return !!game.keys[CONTROLS.jump]; },
  get handbrake() { return !!game.keys[CONTROLS.handbrake]; },
  get aiming() { return game.weapon === 'pistol' && !game.inCar; },
};

window.addEventListener('keydown', (e) => {
  if (e.code === CONTROLS.pause && game.state === 'playing') {
    pauseGame();
    return;
  }
  if (e.code === CONTROLS.pause && game.state === 'paused') {
    resumeGame();
    return;
  }
  game.keys[e.code] = true;
  if (e.code === CONTROLS.camera && game.state === 'playing') {
    game.camMode = (game.camMode + 1) % 3;
  }
  if (e.code === CONTROLS.enterCar && game.state === 'playing') toggleCar();
  if (e.code === CONTROLS.resetCar && game.inCar) resetCar();
  if (e.code === CONTROLS.weaponFists) game.weapon = 'fists';
  if (e.code === CONTROLS.weaponPistol) game.weapon = 'pistol';
  if (e.code === CONTROLS.reload && game.weapon === 'pistol') {
    game.ammo = FIGHT.pistolMag;
    showToast(hud, 'Reloaded');
  }
  if (e.code === CONTROLS.punch && game.state === 'playing' && !game.inCar) doPunch();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  unlockAudio();
});
window.addEventListener('keyup', (e) => {
  game.keys[e.code] = false;
});
renderer.domElement.addEventListener('mousedown', (e) => {
  game.mouseDown = true;
  game.lastX = e.clientX;
  game.lastY = e.clientY;
  unlockAudio();
  if (game.state === 'playing' && game.weapon === 'pistol' && !game.inCar) doShoot();
});
window.addEventListener('mouseup', () => {
  game.mouseDown = false;
});
window.addEventListener('mousemove', (e) => {
  if (!game.mouseDown) return;
  game.camYaw -= (e.clientX - game.lastX) * 0.005;
  game.camPitch = THREE.MathUtils.clamp(game.camPitch + (e.clientY - game.lastY) * 0.004, -0.15, 1.1);
  game.lastX = e.clientX;
  game.lastY = e.clientY;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- car stealing ------------------------------------------------------------
function toggleCar() {
  if (game.inCar) {
    // Step out beside the car.
    const side = new THREE.Vector3(Math.cos(playerCar.heading), 0, -Math.sin(playerCar.heading));
    hero.pos.copy(playerCar.pos).addScaledVector(side, 2.4);
    hero.pos.y = 0;
    hero.mesh.visible = true;
    hero.mesh.position.copy(hero.pos);
    playerCar.active = false;
    parkedCars.push({ mesh: playerCar.mesh, pos: playerCar.pos, heading: playerCar.heading });
    playerCar = makePlayerCar(scene, 0xc23b2e);
    playerCar.mesh.visible = false;
    game.inCar = false;
    setEngine(0, false);
    return;
  }
  const candidates = [
    ...traffic.map((t) => ({ mesh: t.mesh, pos: t.pos, heading: t.heading, traffic: t })),
    ...parkedCars.map((p) => ({ mesh: p.mesh, pos: p.pos, heading: p.heading, parked: p })),
  ];
  const near = nearestCar(hero.pos, candidates, CAR.stealRange);
  if (!near) {
    showToast(hud, 'No car close enough — walk up to one and press E');
    return;
  }
  if (near.traffic) {
    const idx = traffic.indexOf(near.traffic);
    if (idx >= 0) traffic.splice(idx, 1);
  }
  if (near.parked) {
    const idx = parkedCars.indexOf(near.parked);
    if (idx >= 0) parkedCars.splice(idx, 1);
  }
  playerCar = { mesh: near.mesh, pos: near.pos, heading: near.heading, speed: 0, active: true };
  hero.mesh.visible = false;
  game.inCar = true;
  game.camYaw = near.heading;
  addStars(wanted, scene, 1, city.roadLines, () => rng.next(), hero.pos);
  showToast(hud, 'Car stolen — the cops noticed (+1 ★)');
  questsStepCheck();
}

function resetCar() {
  const line = city.roadLines[0];
  playerCar.pos.set(line, 0, 0);
  playerCar.heading = 0;
  playerCar.speed = 0;
}

// --- combat actions ----------------------------------------------------------
function doShoot() {
  if (game.ammo <= 0) {
    showToast(hud, 'Out of ammo — press R to reload');
    return;
  }
  game.ammo--;
  const hit = shootPistol(camera, guards);
  if (hit) {
    const killed = damageGuard(hit, FIGHT.pistolDamage);
    if (killed) {
      removeGuard(scene, hit);
      guards = guards.filter((g) => g.alive);
      showToast(hud, 'Guard down');
    }
    addStars(wanted, scene, 1, city.roadLines, () => rng.next(), hero.pos);
  }
  questsStepCheck();
}

function doPunch() {
  const hit = punch(hero.pos, hero.heading, guards);
  if (hit) {
    const killed = damageGuard(hit, FIGHT.punchDamage);
    if (killed) {
      removeGuard(scene, hit);
      guards = guards.filter((g) => g.alive);
      showToast(hud, 'Guard down');
    }
    addStars(wanted, scene, 1, city.roadLines, () => rng.next(), hero.pos);
  }
}

// --- missions ----------------------------------------------------------------
function questsStepCheck() {
  const result = updateQuests(quests, {
    player: hero.pos,
    inCar: game.inCar,
    stars: wanted.stars,
    guardsLeft: guards.filter((g) => g.alive).length,
  }, (reward) => {
    hero.cash += reward;
    playCash();
    showToast(hud, `Job done — +$${reward}`, 3200);
  });
  if (result === 'mission') {
    const m = currentMission(quests);
    if (quests.done) {
      game.state = 'done';
      showMenu(hud, 'ALL JOBS DONE', 'Every job for Eddie is finished. Coral Keys is yours, Dana.', 'Keep playing');
      saveGame();
    } else if (m) {
      showToast(hud, `New job: ${m.name} — ${m.briefing}`, 4200);
    }
  }
}

// Dock guards for the "Dockside Exchange" job.
function spawnDockGuards() {
  for (const g of guards) removeGuard(scene, g);
  guards = [
    makeGuard(scene, 176, -6, Math.PI / 2),
    makeGuard(scene, 190, 7, -Math.PI / 2),
    makeGuard(scene, 198, -4, Math.PI),
  ];
}

// --- state machine -----------------------------------------------------------
function startGame() {
  hideMenu(hud);
  game.state = 'playing';
  startMusic();
  loadGame();
}

function pauseGame() {
  game.state = 'paused';
  showMenu(hud, 'PAUSED', 'Take a breath. The city waits.', 'Resume');
  saveGame();
}

function resumeGame() {
  hideMenu(hud);
  game.state = 'playing';
}

function endGame(kind) {
  game.state = kind;
  saveGame();
  if (kind === 'busted') {
    setStars(wanted, scene, 0, city.roadLines, () => rng.next());
    showMenu(hud, 'BUSTED', 'The Coral Keys PD caught up with you. Eddie posts bail — this time.', 'Try again');
  } else {
    showMenu(hud, 'WASTED', 'Dana went down in Coral Keys. The city does not wait.', 'Try again');
  }
}

hud.menuButton.addEventListener('click', () => {
  unlockAudio();
  if (game.state === 'menu' || game.state === 'done') {
    startGame();
  } else if (game.state === 'paused') {
    resumeGame();
  } else {
    // busted / wasted: reset the run.
    hero.health = HERO.maxHealth;
    hero.pos.set(city.places.spawn.x, 0, city.places.spawn.z);
    hero.mesh.visible = true;
    game.inCar = false;
    startGame();
  }
});

// --- save / load -------------------------------------------------------------
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: hero.cash,
      mission: quests.index,
      x: hero.pos.x,
      z: hero.pos.z,
    }));
  } catch { /* storage unavailable */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.cash === 'number') hero.cash = s.cash;
    if (typeof s.mission === 'number' && s.mission > 0 && s.mission < quests.missions.length) {
      quests.index = s.mission;
      quests.step = 0;
    }
  } catch { /* corrupted save */ }
}

// --- camera ------------------------------------------------------------------
function updateCamera(dt) {
  const target = game.inCar ? playerCar.pos : hero.pos;
  const dist = game.inCar ? [9, 6.5, 13][game.camMode] : [7.5, 5.5, 11][game.camMode];
  const height = game.inCar ? [3.4, 2.4, 6][game.camMode] : [3.2, 2.2, 5.5][game.camMode];
  const yaw = game.inCar ? playerCar.heading : game.camYaw;
  const px = target.x - Math.sin(yaw) * Math.cos(game.camPitch) * dist;
  const pz = target.z - Math.cos(yaw) * Math.cos(game.camPitch) * dist;
  const py = target.y + height + Math.sin(game.camPitch) * dist * 0.6;
  camera.position.set(px, py, pz);
  camera.lookAt(target.x, target.y + 1.6, target.z);
  if (game.inCar) {
    // While driving the camera follows the car's heading.
    game.camYaw = playerCar.heading;
  }
}

// --- staging for screenshots -------------------------------------------------
function stageShot() {
  startGame();
  if (SHOT === 'start') {
    // Cover: the menu over a high view of the city.
    game.state = 'menu';
    camera.position.set(70, 55, 150);
    camera.lookAt(0, 10, 0);
    showMenu(hud, 'CORAL KEYS', 'Five jobs. One city. No mercy. Dana Cole owes fixer Eddie Marlow a favour — and Coral Keys collects.', 'Start game');
    return 'staged-menu';
  }
  if (SHOT === 'drive') {
    const line = city.roadLines[4];
    playerCar = { mesh: makeCarMesh(0xc23b2e), pos: new THREE.Vector3(line, 0, -40), heading: 0, speed: 14, active: true };
    scene.add(playerCar.mesh);
    hero.mesh.visible = false;
    game.inCar = true;
    game.camMode = 0;
    game.keys[CONTROLS.forward] = true; // cruise: the staged car keeps driving
    return 'staged-drive';
  }
  if (SHOT === 'chase') {
    const line = city.roadLines[4];
    playerCar = { mesh: makeCarMesh(0xc23b2e), pos: new THREE.Vector3(line, 0, -20), heading: 0, speed: 16, active: true };
    scene.add(playerCar.mesh);
    hero.mesh.visible = false;
    game.inCar = true;
    game.camMode = 0;
    game.keys[CONTROLS.forward] = true; // cruise: the staged car keeps driving
    setStars(wanted, scene, 2, city.roadLines, () => rng.next());
    return 'staged-chase';
  }
  if (SHOT === 'mission') {
    quests.index = 3;
    quests.step = 1;
    hero.pos.set(168, 0, 2);
    hero.heading = Math.PI / 2;
    game.weapon = 'pistol';
    game.godMode = true; // staged shot: the guards shoot, but Dana cannot die
    spawnDockGuards();
    game.camYaw = Math.PI / 2;
    game.camPitch = 0.25;
    return 'staged-mission';
  }
  return 'staged';
}

// --- main loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames++;
  if (game.state === 'playing') {
    game.time += dt;
    if (game.inCar) {
      drivePlayerCar(playerCar, input, dt, city.colliders);
      // Staged driving shots loop the car down the same avenue so the
      // screenshot always catches it mid-drive, never parked at the edge.
      if (STAGED && (SHOT === 'drive' || SHOT === 'chase') && playerCar.pos.z > 180) {
        playerCar.pos.z = -180;
      }
      setEngine(Math.abs(playerCar.speed) / CAR.maxSpeed, true);
    } else {
      updateHero(hero, input, game.camYaw, dt, city.colliders);
      setEngine(0, false);
    }
    for (const t of traffic) updateTraffic(t, dt);
    const threats = [];
    if (game.inCar && Math.abs(playerCar.speed) > 5) {
      threats.push({ x: playerCar.pos.x, z: playerCar.pos.z, radius: 8 });
    }
    for (const w of walkers) updatePedestrian(w, dt, threats);
    const busted = updateCops(wanted, scene, dt, {
      x: game.inCar ? playerCar.pos.x : hero.pos.x,
      z: game.inCar ? playerCar.pos.z : hero.pos.z,
      speed: game.inCar ? playerCar.speed : 0,
    }, city.roadLines, () => rng.next());
    setSiren(wanted.cruisers.length > 0);
    // Staged chase: keep both cruisers in frame — one head-on in the
    // next lane, one in the lane beside the player — so the screenshot
    // reads as a chase. (In real play they chase freely; the posing
    // only frames the staged shot.)
    if (STAGED && SHOT === 'chase' && wanted.cruisers.length >= 2) {
      const h = playerCar.heading;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      const lx = Math.cos(h);
      const lz = -Math.sin(h);
      const c0 = wanted.cruisers[0];
      c0.pos.set(playerCar.pos.x + fx * 28 + lx * 5, 0, playerCar.pos.z + fz * 28 + lz * 5);
      c0.heading = h + Math.PI;
      c0.mesh.position.copy(c0.pos);
      c0.mesh.rotation.y = c0.heading;
      const c1 = wanted.cruisers[1];
      c1.pos.set(playerCar.pos.x + fx * 20 - lx * 5.5, 0, playerCar.pos.z + fz * 20 - lz * 5.5);
      c1.heading = h;
      c1.mesh.position.copy(c1.pos);
      c1.mesh.rotation.y = c1.heading;
    }
    if (busted === 'busted') {
      endGame('busted');
    }
    const dmg = updateGuards(guards, dt, hero.pos, () => playGunshot());
    if (dmg > 0 && !game.godMode) {
      hero.health -= dmg;
      if (hero.health <= 0) {
        hero.health = 0;
        endGame('wasted');
      }
    }
    questsStepCheck();
    updateBeacon(quests, { player: hero.pos });
    // HUD + minimap.
    const target = missionTarget(quests);
    const dist = target ? Math.hypot(hero.pos.x - target.x, hero.pos.z - target.z) : null;
    updateHud(hud, {
      health: hero.health,
      cash: hero.cash,
      stars: wanted.stars,
      time: game.time,
      objective: missionObjectiveText(quests),
      dist,
      speed: game.inCar ? playerCar.speed : 0,
      ammo: game.ammo,
      weapon: game.weapon,
      inCar: game.inCar,
      staged: STAGED,
    });
    if (frames % 6 === 0) {
      drawMinimap(hud, {
        roadLines: city.roadLines,
        beacon: missionTarget(quests),
        traffic: traffic.map((t) => ({ x: t.pos.x, z: t.pos.z })),
        cops: wanted.cruisers.map((c) => ({ x: c.pos.x, z: c.pos.z })),
        player: {
          x: game.inCar ? playerCar.pos.x : hero.pos.x,
          z: game.inCar ? playerCar.pos.z : hero.pos.z,
          heading: game.inCar ? playerCar.heading : hero.heading,
        },
      });
    }
  }
  if (game.state === 'menu' && SHOT !== 'start') {
    // Idle orbit behind the menu on a normal load.
    const t = clock.elapsedTime * 0.05;
    camera.position.set(Math.sin(t) * 140, 60, Math.cos(t) * 140);
    camera.lookAt(0, 10, 0);
    if (frames % 30 === 0) {
      drawMinimap(hud, {
        roadLines: city.roadLines,
        beacon: missionTarget(quests),
        traffic: traffic.map((t) => ({ x: t.pos.x, z: t.pos.z })),
        cops: [],
        player: { x: hero.pos.x, z: hero.pos.z, heading: hero.heading },
      });
    }
  } else if (game.state !== 'menu' || SHOT === 'start') {
    if (SHOT !== 'start' || game.state !== 'menu') updateCamera(dt);
  }
  // Staged menu shots also get a live minimap (otherwise it stays black).
  if (STAGED && game.state === 'menu' && frames % 30 === 0) {
    drawMinimap(hud, {
      roadLines: city.roadLines,
      beacon: missionTarget(quests),
      traffic: traffic.map((t) => ({ x: t.pos.x, z: t.pos.z })),
      cops: [],
      player: { x: hero.pos.x, z: hero.pos.z, heading: hero.heading },
    });
  }
  // Gentle sea shimmer.
  city.sea.position.y = 0.05 + Math.sin(clock.elapsedTime * 0.7) * 0.05;
  renderer.render(scene, camera);
}

// --- debug handle (getters, never stale snapshots) ---------------------------
Object.defineProperty(window, '__coralKeys', {
  value: {
    get game() { return game; },
    get hero() { return hero; },
    get car() { return playerCar; },
    get quests() { return quests; },
    get wanted() { return wanted; },
    get traffic() { return traffic; },
    get guards() { return guards; },
    get state() { return game.state; },
    setStars(n) { setStars(wanted, scene, n, city.roadLines, () => rng.next()); },
    start() { startGame(); },
    get shot() { return SHOT; },
    get frames() { return frames; },
  },
});

// --- go ----------------------------------------------------------------------
if (STAGED) {
  stageShot();
  // Staged shots hide the toast so it never covers the action.
  hud.toast.style.display = 'none';
  if (SHOT === 'start') {
    // Keep the menu up for the cover shot.
    game.state = 'menu';
  }
} else {
  showMenu(hud, 'CORAL KEYS', 'Five jobs. One city. No mercy. Dana Cole owes fixer Eddie Marlow a favour — and Coral Keys collects.', 'Start game');
}
animate();
