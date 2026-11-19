// Coral Keys — shared tuning numbers (rebuild #3).
//
// One place for every number the city, cars, police, combat and missions
// agree on. Nothing here needs three.js, so any tool can read it plain.

export const WORLD = {
  blocks: 9, // blocks across and down
  blockSize: 34, // metres of built ground per block
  roadWidth: 12, // metres of asphalt between blocks
  get pitch() {
    return this.blockSize + this.roadWidth;
  },
  // Half-width of the built-up area, roads included.
  get half() {
    return (this.blocks * this.pitch + this.roadWidth) / 2;
  },
  beachWidth: 26, // sand strip on the east edge
  seaWidth: 130, // water beyond the beach
  // Height of the tallest tower, used to size the skyline.
  maxTower: 74,
};

export const HERO = {
  walkSpeed: 6,
  runSpeed: 10.5,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  jumpSpeed: 8.5,
  gravity: 24,
  // How far the third-person camera sits behind the hero.
  camDistance: 7.5,
  camHeight: 3.2,
};

export const CAR = {
  accel: 20,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38,
  maxReverse: 12,
  steer: 2.1,
  grip: 0.92,
  handbrakeGrip: 0.6,
  // Distance at which E can steal a parked or traffic car.
  stealRange: 3.4,
  trafficCount: 14,
};

export const HEAT = {
  maxStars: 5,
  hideDelay: 14, // seconds unseen before stars start falling
  hideStep: 6, // seconds per star lost while hidden
  // Cruisers on the road at each star level.
  cruisersFor(stars) {
    return [0, 1, 2, 3, 4, 6][stars] ?? 0;
  },
  arrestRange: 2.6,
  arrestTime: 2.2, // seconds a cruiser must sit on the player to bust them
};

export const FIGHT = {
  pistolDamage: 34,
  pistolMag: 12,
  pistolRange: 90,
  punchDamage: 12,
  punchRange: 2.4,
  guardHealth: 70,
  guardShootRange: 42,
  guardShootDelay: 1.4,
};

export const CONTROLS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  run: 'ShiftLeft',
  enterCar: 'KeyE',
  punch: 'KeyF',
  reload: 'KeyR',
  handbrake: 'Space',
  camera: 'KeyC',
  weaponFists: 'Digit1',
  weaponPistol: 'Digit2',
  pause: 'KeyP',
  resetCar: 'KeyT',
};

export const SAVE_KEY = 'coral-keys-save-v3';

export const PALETTE = {
  sky: 0x8ec9e8,
  sea: 0x1f7fa8,
  sand: 0xe8d5a3,
  asphalt: 0x33363b,
  sidewalk: 0x9a9a92,
  grass: 0x4f9e4d,
  building: [0xb8a88a, 0x9aa7b8, 0xc49a7a, 0x8fa3a0, 0xd0b49a, 0xa89ac0],
  windowLit: 0xffd97a,
  windowDark: 0x2c3a4a,
  // Car paint jobs the city spawns.
  carPaint: [0xc23b2e, 0x2e6fc2, 0xe8b93a, 0x3aa655, 0x8a8f96, 0x7a4fb5, 0xe86a2a, 0x22262b],
};
