// Coral Keys — boot: renderer, input, camera, game states, main loop.
//
// The game runs in five states: menu, playing, paused, busted, wasted
// and done (the last three are overlays on a frozen world). The loop
// steps traffic, pedestrians, the hero, the police, combat and the
// missions, then draws the HUD and the minimap. `?shot=` stages one of
// the four screenshots; `?seed=` picks the city seed. The live state is
// exposed on `window.__coralKeys` so tests can drive the game.

import * as THREE from '../vendor/three.module.min.js';
import { makeDice } from './seed.js';
import { WORLD, HERO, CAR, HEAT, SAVE_KEY, PALETTE } from './settings.js';
import { City } from './city.js';
import { PlayerCar, Traffic } from './cars.js';
import { Pedestrians } from './people.js';
import { Hero } from './hero.js';
import { Police } from './cops.js';
import { Combat } from './fight.js';
import { Quests } from './quests.js';
import { Interface } from './interface.js';
import { SoundBank } from './sound.js';

const params = new URLSearchParams(window.location.search);
const SEED = Number(params.get('seed') || 1);
const SHOT = params.get('shot') || '';

export class Game {
  constructor() {
    this.dice = makeDice(SEED);
    this.sound = new SoundBank();
    this.ui = new Interface(document);
    this.clock = new THREE.Clock();
    this.gameTime = 10 * 3600; // 10:00 in the morning.
    this.state = 'menu';
    this.camYaw = Math.PI * 0.75;
    this.camPitch = 0.34;
    this.camMode = 0;
    this.camDist = [7.5, 11.5, 17][0];
    this.keys = new Set();
    this.mouseDown = false;
    this.save = this.loadSave();

    // Renderer + scene.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('game').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.sky, 180, 520);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

    // Sun + sky light.
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
    sun.position.set(120, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 600;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3d5a3a, 0.9));

    // World + systems.
    this.city = new City(this.scene, this.dice);
    this.traffic = new Traffic(this.scene, this.dice, this.city);
    this.peds = new Pedestrians(this.scene, this.dice);
    this.hero = new Hero(this.scene);
    this.playerCar = new PlayerCar(this.scene, 0xc0392b);
    this.police = new Police(this.scene, this.city);
    this.combat = new Combat(this.scene);
    this.quests = new Quests(this.scene, this.city);

    // Start position: the north road, facing the casino.
    this.hero.place(0, -WORLD.half + 30, Math.PI);
    this.bindInput();
    this.bindButtons();
    this.applyShot();
    // The menu only owns the screen when no screenshot is staged (or
    // for the start shot, which is the menu over the city). The drive,
    // chase and mission shots stage gameplay and already set the UI.
    if (!SHOT || SHOT === 'start') {
      this.ui.setMenu('CORAL KEYS', 'An open-world crime story in a beach city. Steal cars, dodge the cops, run Eddie\'s jobs.', !!this.save);
      this.ui.showOnly(['menu']);
    }
    this.ui.updateHud(this.hudState(0));
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------- save ----------
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.hero.money,
        health: this.hero.health,
        quests: this.quests.saveState(),
      }));
    } catch {
      // Private mode / no storage: the game still plays.
    }
  }

  // ---------- input ----------
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.sound.unlock();
      if (this.state !== 'playing') return;
      if (e.code === 'KeyE') this.tryEnterCar();
      if (e.code === 'KeyF') this.tryPunch();
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'KeyC') this.cycleCamera();
      if (e.code === 'KeyT') this.resetCar();
      if (e.code === 'Digit1') this.hero.weapon = 'fists';
      if (e.code === 'Digit2') this.hero.weapon = 'pistol';
      if (e.code === 'KeyP') this.pauseGame();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      this.sound.unlock();
      if (this.state === 'playing' && !this.hero.inCar) {
        try {
          canvas.requestPointerLock();
        } catch {
          // Headless browsers refuse pointer lock; the game still works.
        }
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas && this.state === 'playing') {
        this.camYaw -= e.movementX * 0.0026;
        this.camPitch = Math.max(0.08, Math.min(0.9, this.camPitch + e.movementY * 0.002));
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.state !== 'playing') return;
      this.sound.unlock();
      if (!this.hero.inCar && this.hero.weapon === 'pistol') this.tryShoot();
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  bindButtons() {
    const on = (id, fn) => this.ui.el[id]?.addEventListener('click', () => {
      this.sound.unlock();
      fn();
    });
    on('menu-play', () => this.startGame(false));
    on('menu-continue', () => this.startGame(true));
    on('pause-resume', () => this.resumeGame());
    on('pause-restart', () => this.startGame(false));
    on('busted-retry', () => this.respawn());
    on('wasted-retry', () => this.respawn());
    on('done-again', () => this.startGame(false));
  }

  // ---------- state changes ----------
  startGame(continueSave) {
    this.hero.health = HERO.maxHealth;
    this.hero.inCar = false;
    this.playerCar.active = false;
    this.police.clearHeat();
    this.combat.clearEnemies();
    if (continueSave && this.save) {
      this.hero.money = this.save.money ?? 0;
      this.hero.health = this.save.health ?? HERO.maxHealth;
      this.quests.loadState(this.save.quests);
    } else {
      this.hero.money = 0;
      this.quests.dispose();
      this.quests = new Quests(this.scene, this.city);
    }
    this.hero.place(0, -WORLD.half + 30, Math.PI);
    this.camYaw = Math.PI;
    this.state = 'playing';
    this.ui.showOnly([]);
    this.ui.show('hud');
    this.ui.toast(this.quests.objectiveText());
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.writeSave();
    this.ui.showOnly(['pause']);
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showOnly([]);
    this.ui.show('hud');
  }

  respawn() {
    this.hero.health = HERO.maxHealth;
    this.hero.inCar = false;
    this.hero.place(0, -WORLD.half + 30, Math.PI);
    this.playerCar.active = false;
    this.police.clearHeat();
    this.combat.clearEnemies();
    this.state = 'playing';
    this.ui.showOnly([]);
    this.ui.show('hud');
  }

  bust() {
    this.state = 'busted';
    const fine = Math.min(100, this.hero.money);
    this.hero.money -= fine;
    this.sound.busted();
    this.writeSave();
    this.ui.el['busted'].querySelector('p').textContent = `The cops caught up with Dana. Fine: $${fine}.`;
    this.ui.showOnly(['busted']);
  }

  waste() {
    this.state = 'wasted';
    const lost = Math.min(150, this.hero.money);
    this.hero.money -= lost;
    this.sound.busted();
    this.writeSave();
    this.ui.el['wasted'].querySelector('p').textContent = `Dana is down. The crew took $${lost} off her.`;
    this.ui.showOnly(['wasted']);
  }

  finishAll() {
    this.state = 'done';
    this.writeSave();
    this.ui.showOnly(['done']);
  }

  // ---------- actions ----------
  tryEnterCar() {
    if (this.hero.inCar) {
      // Get out on the driver's side.
      this.hero.inCar = false;
      const side = this.playerCar.heading + Math.PI / 2;
      this.hero.place(
        this.playerCar.pos.x + Math.sin(side) * 2.2,
        this.playerCar.pos.z + Math.cos(side) * 2.2,
        this.playerCar.heading,
      );
      this.playerCar.sync();
      return;
    }
    const stolen = this.hero.trySteal(this.traffic, this.playerCar);
    if (!stolen) return;
    if (stolen.kind === 'traffic') {
      this.playerCar = new PlayerCar(this.scene, stolen.color);
      this.playerCar.place(stolen.x, stolen.z, stolen.heading);
      this.police.addHeat(1, this.gameTime);
      this.ui.toast('Car stolen — the cops noticed (+1 ★)');
      this.sound.pickup();
      // A fresh traffic car keeps the streets busy.
      this.traffic.spawn();
    } else {
      this.playerCar.place(stolen.x, stolen.z, stolen.heading);
    }
    this.hero.inCar = true;
    this.hero.group.visible = false;
  }

  tryPunch() {
    if (!this.hero.punch()) return;
    this.sound.punch();
    const hits = this.combat.punch(this.hero.pos, this.hero.heading);
    if (hits > 0) {
      this.police.addHeat(1, this.gameTime);
      this.ui.toast('That guard won\'t be getting up.');
    }
  }

  tryShoot() {
    const res = this.combat.shoot(this.camera, this.hero);
    if (!res.fired) {
      this.ui.toast('Out of ammo — press R to reload');
      this.sound.blip(180, 0.15, 0.25);
      return;
    }
    this.sound.gunshot();
    this.police.addHeat(1, this.gameTime);
    if (res.hit) this.ui.toast('Hit!');
  }

  reload() {
    if (this.hero.weapon !== 'pistol' || this.hero.reserveAmmo <= 0) return;
    const need = 12 - this.hero.ammo;
    const take = Math.min(need, this.hero.reserveAmmo);
    this.hero.ammo += take;
    this.hero.reserveAmmo -= take;
    this.sound.blip(520, 0.08, 0.2);
  }

  cycleCamera() {
    this.camMode = (this.camMode + 1) % 3;
    this.camDist = [7.5, 11.5, 17][this.camMode];
  }

  resetCar() {
    if (!this.hero.inCar) return;
    this.playerCar.speed = 0;
    this.playerCar.pos.y = 0;
    this.city.resolveCircle(this.playerCar.pos, 1.4);
    this.playerCar.sync();
  }

  // ---------- staging for screenshots ----------
  applyShot() {
    if (!SHOT) return;
    this.stagedShot = true;
    // Staged shots never show transient toasts over the action.
    this.ui.hide('toast');
    const L = this.city.landmarks;
    if (SHOT === 'start') {
      this.state = 'menu';
      this.hero.place(0, -WORLD.half + 40, Math.PI);
      this.camYaw = Math.PI * 0.9;
      this.camPitch = 0.42;
      this.camMode = 2;
      this.camDist = 17;
    } else if (SHOT === 'drive') {
      this.state = 'playing';
      this.ui.showOnly([]);
      this.ui.show('hud');
      const road = -WORLD.half + WORLD.roadWidth / 2 + 4 * WORLD.pitch;
      this.playerCar.place(road, -40, 0);
      this.playerCar.speed = 19;
      this.hero.inCar = true;
      this.hero.group.visible = false;
      this.camYaw = 0;
      this.camMode = 0;
      this.camDist = 7.5;
    } else if (SHOT === 'chase') {
      this.state = 'playing';
      this.ui.showOnly([]);
      this.ui.show('hud');
      const road = -WORLD.half + WORLD.roadWidth / 2 + 4 * WORLD.pitch;
      this.playerCar.place(road, 10, 0);
      this.playerCar.speed = 22;
      this.hero.inCar = true;
      this.hero.group.visible = false;
      this.police.addHeat(3, this.gameTime);
      // Park the cruisers where the camera can see them: one coming
      // head-on down the road, one closing from the left lane.
      const spots = [
        { x: road, z: 26, heading: Math.PI, speed: 12 },
        { x: road - 4, z: -2, heading: 0, speed: 12 },
        { x: road + 5, z: 18, heading: Math.PI, speed: 10 },
      ];
      this.police.cruisers.forEach((c, i) => {
        const s = spots[i % spots.length];
        c.pos.set(s.x, 0, s.z);
        c.speed = s.speed;
        c.heading = s.heading;
      });
      this.camYaw = Math.PI * 0.15;
      this.camMode = 1;
      this.camDist = 11.5;
    } else if (SHOT === 'mission') {
      this.state = 'playing';
      this.ui.showOnly([]);
      this.ui.show('hud');
      // Jump to the dockside mission: index 3, step 0 (clear guards).
      this.quests.missionIndex = 3;
      this.quests.stepIndex = 0;
      this.quests.moveBeacon();
      this.quests.ensureGuards(this.combat);
      // Stand south of the dock, facing the guards and the beacon.
      this.hero.place(L.dock.x, L.dock.z - 18, 0);
      this.hero.weapon = 'pistol';
      this.hero.sync();
      this.camYaw = Math.PI;
      this.camMode = 0;
      this.camDist = 7.5;
    }
    this.snapCamera = true;
  }

  // ---------- per-frame ----------
  hudState(dt) {
    const target = this.quests.objectiveTarget();
    return {
      dt,
      health: this.hero.health,
      money: this.hero.money,
      stars: this.police.stars,
      clock: this.gameTime,
      objective: this.quests.objectiveText(),
      objectiveTarget: target,
      inCar: this.hero.inCar,
      speed: this.playerCar.speed,
      weapon: this.hero.weapon,
      ammo: this.hero.ammo,
      reserveAmmo: this.hero.reserveAmmo,
      player: { x: this.hero.inCar ? this.playerCar.pos.x : this.hero.pos.x, z: this.hero.inCar ? this.playerCar.pos.z : this.hero.pos.z, heading: this.hero.inCar ? this.playerCar.heading : this.hero.heading },
      police: this.police.cruisers.map((c) => ({ x: c.pos.x, z: c.pos.z })),
    };
  }

  inputState() {
    const k = this.keys;
    return {
      fwd: k.has('KeyW') || k.has('ArrowUp'),
      back: k.has('KeyS') || k.has('ArrowDown'),
      left: k.has('KeyA') || k.has('ArrowLeft'),
      right: k.has('KeyD') || k.has('ArrowRight'),
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      jump: k.has('Space'),
      brake: k.has('Space'),
      camYaw: this.camYaw,
    };
  }

  updateCamera(dt) {
    const focus = this.hero.inCar ? this.playerCar.pos : this.hero.pos;
    const heading = this.hero.inCar ? this.playerCar.heading : this.camYaw;
    // Behind the player: camera sits opposite the facing direction.
    const back = this.hero.inCar ? heading + Math.PI : this.camYaw;
    const dist = this.camDist;
    const height = 2.2 + dist * 0.32 + this.camPitch * 4;
    const want = new THREE.Vector3(
      focus.x + Math.sin(back) * dist,
      height,
      focus.z + Math.cos(back) * dist,
    );
    if (this.snapCamera) {
      this.camera.position.copy(want);
      this.snapCamera = false;
    } else {
      this.camera.position.lerp(want, Math.min(1, dt * 6));
    }
    this.camera.lookAt(focus.x, focus.y + 1.7, focus.z);
    // Health bars always face the camera.
    const q = this.camera.quaternion;
    for (const e of this.combat.enemies) {
      for (const child of e.mesh.children) {
        if (child.geometry?.type === 'PlaneGeometry') child.quaternion.copy(e.mesh.quaternion.clone().invert().multiply(q));
      }
    }
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.state === 'playing') {
      this.gameTime += dt * 60;
      const input = this.inputState();
      const heroPos = this.hero.inCar ? this.playerCar.pos : this.hero.pos;
      // Drive or walk.
      if (this.hero.inCar) {
        this.playerCar.drive(
          { fwd: input.fwd, back: input.back, left: input.left, right: input.right, brake: input.brake },
          dt,
        );
        this.city.resolveCircle(this.playerCar.pos, 1.4);
        this.playerCar.sync();
        this.sound.setEngine(Math.abs(this.playerCar.speed) / CAR.maxSpeed);
      } else {
        this.hero.step(input, dt, this.city);
        this.sound.setEngine(0);
      }
      // Traffic + pedestrians.
      this.traffic.update(dt, heroPos);
      const threats = [{ x: heroPos.x, z: heroPos.z }];
      this.peds.update(dt, threats);
      // Police.
      const playerSpeed = this.hero.inCar ? Math.abs(this.playerCar.speed) : (input.fwd || input.back ? 5 : 0);
      if (this.police.update(dt, heroPos, playerSpeed, this.gameTime) === 'arrested') {
        this.bust();
      }
      this.sound.setSiren(this.police.stars > 0, this.gameTime);
      // Combat: enemy fire.
      const dmg = this.combat.update(dt, heroPos, () => this.sound.burst(900, 0.1, 0.2));
      if (dmg > 0 && this.hero.takeDamage(dmg)) {
        this.waste();
      }
      // Missions.
      this.quests.ensureGuards(this.combat);
      const event = this.quests.update({
        dt,
        heroPos,
        inCar: this.hero.inCar,
        stars: this.police.stars,
        enemiesAlive: this.combat.aliveCount(),
      });
      if (event?.type === 'paid') {
        this.hero.money += event.pay;
        this.hero.heal(25);
        this.sound.missionDone();
        if (!this.stagedShot) this.ui.toast(`Job done — Eddie paid $${event.pay}`);
        this.writeSave();
      } else if (event?.type === 'all-done') {
        this.hero.money += event.pay;
        this.sound.missionDone();
        this.finishAll();
      } else if (event?.type === 'step') {
        this.sound.pickup();
        if (!this.stagedShot) this.ui.toast(this.quests.objectiveText());
      }
      this.sound.updateMusic(dt, true);
      this.ui.updateHud(this.hudState(dt));
      this.ui.drawMap(this.hudState(dt));
    } else if (this.state === 'menu') {
      // Slow orbit over the city behind the menu.
      this.camYaw += dt * 0.03;
      const focus = new THREE.Vector3(0, 0, 0);
      this.camera.position.set(Math.sin(this.camYaw) * 90, 55, Math.cos(this.camYaw) * 90);
      this.camera.lookAt(focus.x, 10, focus.z);
      this.traffic.update(dt, this.hero.pos);
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();

// Test hooks: the CDP gameplay test drives the game through these.
window.__coralKeys = {
  version: 'coral-keys-v2',
  get state() {
    return game.state;
  },
  hero: game.hero,
  get car() {
    return game.playerCar;
  },
  police: game.police,
  get quests() {
    return game.quests;
  },
  combat: game.combat,
  city: game.city,
  keys: game.keys,
  start: (cont) => game.startGame(!!cont),
  teleport: (x, z) => {
    if (game.hero.inCar) {
      game.playerCar.pos.set(x, 0, z);
      game.playerCar.sync();
    } else {
      game.hero.place(x, z, game.hero.heading);
    }
  },
  setStars: (n) => {
    game.police.stars = n;
    game.police.syncCruisers();
  },
};
